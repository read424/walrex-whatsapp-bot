const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Obtener código QR de WhatsApp Web
 *
 * Responsabilidad:
 * - Validar que la conexión existe y es de tipo whatsapp_web
 * - Verificar permisos del tenant
 * - Obtener el QR code desde el connection manager o desde metadata
 * - Retornar el QR con información adicional
 *
 * Dependencias:
 * - channelConnectionRepository: Para obtener la conexión
 * - whatsAppConnectionManager: Para iniciar conexión y obtener QR
 * - logger: Para registrar operaciones
 */
class GetWhatsAppQRCodeUseCase {
    constructor({ channelConnectionRepository, whatsAppConnectionManager, logger }) {
        if (!channelConnectionRepository) {
            throw new Error('channelConnectionRepository is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.channelConnectionRepository = channelConnectionRepository;
        this.whatsAppConnectionManager = whatsAppConnectionManager;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso para obtener el QR code
     *
     * @param {Object} params - Parámetros
     * @param {number} params.connectionId - ID de la conexión
     * @param {number} params.tenantId - ID del tenant (para verificar permisos)
     * @param {boolean} params.forceRegenerate - Forzar regeneración del QR (opcional)
     *
     * @returns {Promise<Object>} - QR code con información adicional
     */
    async execute({
        connectionId,
        tenantId,
        forceRegenerate = false
    }) {
        const startTime = Date.now();

        this.logger.info('GetWhatsAppQRCodeUseCase', 'Getting WhatsApp QR code', {
            connectionId,
            tenantId,
            forceRegenerate
        });

        try {
            // 1. Validar parámetros
            this.validateParams({ connectionId, tenantId });

            // 2. Obtener la conexión de la base de datos
            const connection = await this.channelConnectionRepository.findById(connectionId);

            if (!connection) {
                throw new IllegalArgumentException('Connection not found');
            }

            // 3. Verificar permisos del tenant
            if (connection.tenantId !== tenantId) {
                throw new IllegalArgumentException('You do not have permission to access this connection');
            }

            // 4. Verificar que sea una conexión de WhatsApp Web
            if (connection.channelType !== 'whatsapp_web') {
                throw new IllegalArgumentException(
                    'This endpoint is only available for whatsapp_web connections'
                );
            }

            // 5. Verificar si ya está autenticado
            if (connection.status === 'authenticated' && !forceRegenerate) {
                this.logger.info('GetWhatsAppQRCodeUseCase', 'Connection already authenticated', {
                    connectionId,
                    phoneNumber: connection.channelConfig?.phoneNumber
                });

                return {
                    success: true,
                    data: {
                        connectionId: connection.id,
                        connectionName: connection.connectionName,
                        status: 'authenticated',
                        message: 'This connection is already authenticated and active',
                        phoneNumber: connection.channelConfig?.phoneNumber,
                        lastSeen: connection.lastSeen,
                        deviceInfo: connection.connectionMetadata?.deviceInfo
                    }
                };
            }

            // 6. Obtener o generar QR code
            let qrCode = null;
            let qrCodeText = null;
            let expiresAt = null;

            // Verificar si la conexión fue cerrada por timeout
            const wasClosedByTimeout = connection.status === 'disconnected' &&
                                       connection.connectionMetadata?.lastError === 'QR timeout occurred';

            // Intentar obtener QR desde metadata si existe y es reciente
            // PERO solo si no fue cerrada por timeout (en ese caso forzar regeneración)
            if (connection.connectionMetadata?.qrCode && !forceRegenerate && !wasClosedByTimeout) {
                const qrGeneratedAt = connection.connectionMetadata?.qrGeneratedAt;
                const qrAge = qrGeneratedAt ? Date.now() - new Date(qrGeneratedAt).getTime() : 999999;

                // Si el QR tiene menos de 60 segundos, usarlo
                if (qrAge < 60000) {
                    qrCode = connection.connectionMetadata.qrCode;
                    qrCodeText = connection.connectionMetadata.qrCodeText;
                    expiresAt = new Date(new Date(qrGeneratedAt).getTime() + 60000);

                    this.logger.info('GetWhatsAppQRCodeUseCase', 'Using existing QR code from metadata', {
                        connectionId,
                        qrAge
                    });
                }
            }

            // Si fue cerrada por timeout, forzar regeneración
            if (wasClosedByTimeout) {
                this.logger.info('GetWhatsAppQRCodeUseCase', 'Connection was closed by timeout, forcing new QR generation', {
                    connectionId
                });
            }

            // Si no hay QR o necesita regenerarse, iniciar conexión si hay manager disponible
            if (!qrCode && this.whatsAppConnectionManager) {
                this.logger.info('GetWhatsAppQRCodeUseCase', 'Initializing WhatsApp connection to generate QR', {
                    connectionId
                });

                try {
                    // Iniciar o reconectar la conexión
                    await this.whatsAppConnectionManager.createNewConnection(
                        connectionId,
                        connection.connectionName,
                        connection.tenantId
                    );

                    // Esperar un momento para que se genere el QR
                    await this.waitForQR(connectionId, 15000); // 15 segundos máximo

                    // Obtener la conexión actualizada
                    const updatedConnection = await this.channelConnectionRepository.findById(connectionId);

                    if (updatedConnection.connectionMetadata?.qrCode) {
                        qrCode = updatedConnection.connectionMetadata.qrCode;
                        qrCodeText = updatedConnection.connectionMetadata.qrCodeText;
                        expiresAt = new Date(Date.now() + 60000); // 60 segundos
                    }
                } catch (error) {
                    this.logger.error('GetWhatsAppQRCodeUseCase', 'Error initializing WhatsApp connection', error, {
                        connectionId
                    });
                    // Continuar sin el QR, lanzaremos error más adelante
                }
            }

            // Si todavía no hay QR, retornar error
            if (!qrCode) {
                this.logger.warn('GetWhatsAppQRCodeUseCase', 'QR code not available', {
                    connectionId,
                    status: connection.status
                });

                return {
                    success: false,
                    message: 'QR code not available yet. The connection is initializing. Please try again in a few seconds.',
                    data: {
                        connectionId: connection.id,
                        connectionName: connection.connectionName,
                        status: connection.status,
                        retryAfter: 3 // segundos
                    }
                };
            }

            this.logger.info('GetWhatsAppQRCodeUseCase', 'QR code retrieved successfully', {
                connectionId,
                duration: Date.now() - startTime
            });

            return {
                success: true,
                data: {
                    connectionId: connection.id,
                    connectionName: connection.connectionName,
                    status: connection.status,
                    qrCode: qrCode,
                    qrCodeText: qrCodeText || undefined,
                    expiresAt: expiresAt,
                    instructions: [
                        '1. Abre WhatsApp en tu teléfono',
                        '2. Ve a Ajustes > Dispositivos vinculados',
                        '3. Toca \'Vincular un dispositivo\'',
                        '4. Escanea este código QR',
                        '5. El código expira en 60 segundos'
                    ]
                }
            };

        } catch (error) {
            this.logger.error('GetWhatsAppQRCodeUseCase', 'Error getting QR code', error, {
                connectionId,
                tenantId
            });
            throw error;
        }
    }

    /**
     * Valida los parámetros de entrada
     * @private
     */
    validateParams({ connectionId, tenantId }) {
        if (!connectionId || typeof connectionId !== 'number') {
            throw new IllegalArgumentException('connectionId is required and must be a number');
        }

        if (!tenantId || typeof tenantId !== 'number') {
            throw new IllegalArgumentException('tenantId is required and must be a number');
        }
    }

    /**
     * Espera a que se genere el QR code
     * @private
     */
    async waitForQR(connectionId, timeout = 15000) {
        const startTime = Date.now();
        const pollInterval = 500; // Revisar cada 500ms

        return new Promise((resolve, reject) => {
            const checkQR = async () => {
                try {
                    const connection = await this.channelConnectionRepository.findById(connectionId);

                    if (connection.connectionMetadata?.qrCode) {
                        this.logger.info('GetWhatsAppQRCodeUseCase', 'QR code detected', {
                            connectionId,
                            waitTime: Date.now() - startTime
                        });
                        resolve(true);
                        return;
                    }

                    if (Date.now() - startTime >= timeout) {
                        this.logger.warn('GetWhatsAppQRCodeUseCase', 'Timeout waiting for QR code', {
                            connectionId,
                            timeout
                        });
                        resolve(false);
                        return;
                    }

                    // Revisar nuevamente
                    setTimeout(checkQR, pollInterval);
                } catch (error) {
                    this.logger.error('GetWhatsAppQRCodeUseCase', 'Error checking for QR code', error, {
                        connectionId
                    });
                    reject(error);
                }
            };

            checkQR();
        });
    }
}

module.exports = GetWhatsAppQRCodeUseCase;
