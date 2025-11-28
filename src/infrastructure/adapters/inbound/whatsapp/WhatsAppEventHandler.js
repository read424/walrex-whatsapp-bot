/**
 * WhatsAppEventHandler
 *
 * Responsabilidades:
 * - Manejo de eventos del cliente WhatsApp (qr, ready, authenticated, disconnected, etc.)
 * - Emisión de eventos a WebSocket para el frontend
 * - Actualización de estado de conexión en base de datos
 * - Delegación a casos de uso apropiados
 *
 * NO contiene lógica de negocio.
 * Esta es una clase de ADAPTADOR (capa de infraestructura - inbound)
 */

const QRCode = require('qrcode');
const qrcode = require('qrcode-terminal');

class WhatsAppEventHandler {
    /**
     * Constructor con inyección de dependencias
     * @param {Object} dependencies - Dependencias
     * @param {Object} dependencies.connectionRepository - Repositorio de conexiones
     * @param {Object} dependencies.whatsappConnectionRepository - Repositorio específico de WhatsApp
     * @param {Object} dependencies.webSocketAdapter - Adaptador de WebSocket
     * @param {Object} dependencies.logger - Logger
     */
    constructor({ connectionRepository, whatsappConnectionRepository, webSocketAdapter, logger }) {
        if (!connectionRepository || !whatsappConnectionRepository || !webSocketAdapter || !logger) {
            throw new Error('All dependencies are required for WhatsAppEventHandler');
        }

        this.connectionRepository = connectionRepository;
        this.whatsappConnectionRepository = whatsappConnectionRepository;
        this.webSocketAdapter = webSocketAdapter;
        this.logger = logger;

        // Estado interno del handler
        this.qrAttempts = 0;
        this.maxQrAttempts = 3;
        this.qrTimeoutTimer = null;
        this.qrTimeoutDuration = 90000; // 90 segundos

        this.logger.info('WhatsAppEventHandler', 'Event handler initialized successfully');
    }

    /**
     * Configura todos los event listeners del cliente WhatsApp
     * @param {Object} client - Cliente de WhatsApp
     * @param {Object} context - Contexto de la conexión
     */
    setupEventListeners(client, context) {
        const { connectionId, tenantId, isConnectionClosed, getDeviceInfo, resetQRAttempts } = context;

        this.logger.info('WhatsAppEventHandler', 'Setting up event listeners', {
            connectionId,
            tenantId
        });

        // Evento QR
        client.on('qr', async (qr) => {
            await this.handleQREvent(qr, context);
        });

        // Evento Ready
        client.on('ready', async () => {
            await this.handleReadyEvent(context);
        });

        // Evento Authenticated
        client.on('authenticated', async (session) => {
            await this.handleAuthenticatedEvent(session, context);
        });

        // Evento Auth Failure
        client.on('auth_failure', async (msg) => {
            await this.handleAuthFailureEvent(msg, context);
        });

        // Evento Disconnected
        client.on('disconnected', async (reason) => {
            await this.handleDisconnectedEvent(reason, context);
        });

        // Evento Loading Screen
        client.on('loading_screen', (percent, message) => {
            this.handleLoadingScreenEvent(percent, message, context);
        });

        this.logger.info('WhatsAppEventHandler', 'Event listeners setup completed', {
            connectionId,
            tenantId
        });
    }

    /**
     * Maneja el evento QR
     * @param {string} qr - Código QR
     * @param {Object} context - Contexto de la conexión
     */
    async handleQREvent(qr, context) {
        const { connectionId, tenantId, isConnectionClosed, handleQRTimeout } = context;

        try {
            if (isConnectionClosed()) {
                this.logger.info('WhatsAppEventHandler', 'Connection closed, skipping QR processing', {
                    connectionId
                });
                return;
            }

            // Si es el primer QR (intentos == 0), verificar si necesitamos limpiar datos antiguos
            if (this.qrAttempts === 0) {
                // Limpiar cualquier QR antiguo de intentos previos
                try {
                    await this.whatsappConnectionRepository.update(connectionId, {
                        qrCode: null,
                        lastError: null
                    });

                    const ChannelConnectionRepositoryImpl = require('../../outbound/persistence/ChannelConnectionRepositoryImpl');
                    const channelConnectionRepo = new ChannelConnectionRepositoryImpl({ logger: this.logger });

                    await channelConnectionRepo.updateMetadata(connectionId, {
                        qrCode: null,
                        qrCodeText: null,
                        qrGeneratedAt: null,
                        lastError: null
                    });

                    this.logger.debug('WhatsAppEventHandler', 'Cleared old QR data before first attempt', {
                        connectionId
                    });
                } catch (error) {
                    this.logger.debug('WhatsAppEventHandler', 'Could not clear old QR data', {
                        connectionId,
                        error: error.message
                    });
                }
            }

            // Llamar el método que maneja el timeout
            await handleQRTimeout();

            // Si se cerró por timeout, no procesar el QR
            if (isConnectionClosed()) return;

            // Incrementar intentos
            this.qrAttempts++;

            // Generar QR en terminal
            qrcode.generate(qr, { small: true });

            this.logger.info('WhatsAppEventHandler', 'QR Code generated - Session not found', {
                clientId: connectionId,
                attempts: this.qrAttempts,
                maxAttempts: this.maxQrAttempts,
                qrLength: qr.length
            });

            // Convertir QR a base64
            const base64QR = await QRCode.toDataURL(qr, { type: 'image/png' });

            // Actualizar en base de datos (tabla antigua whatsapp_connections)
            await this.whatsappConnectionRepository.update(connectionId, {
                qrCode: base64QR,
                status: 'qr_generated'
            });

            // También actualizar en channel_connections (nueva tabla v2)
            try {
                const ChannelConnectionRepositoryImpl = require('../../outbound/persistence/ChannelConnectionRepositoryImpl');
                const channelConnectionRepo = new ChannelConnectionRepositoryImpl({ logger: this.logger });

                // Actualizar connection_metadata con los datos del QR
                await channelConnectionRepo.updateMetadata(connectionId, {
                    qrCode: base64QR,
                    qrCodeText: qr,
                    qrGeneratedAt: new Date().toISOString(),
                    qrAttempts: this.qrAttempts
                });

                // Actualizar status a 'qr_generated' en la tabla principal
                await this.connectionRepository.updateStatus(connectionId, 'qr_generated');

                this.logger.info('WhatsAppEventHandler', 'QR generated and saved - Status updated to qr_generated', {
                    connectionId,
                    attempts: this.qrAttempts
                });
            } catch (error) {
                // Si falla (porque aún no existe la conexión en channel_connections), solo loguear
                this.logger.debug('WhatsAppEventHandler', 'Could not update QR in channel_connections', {
                    connectionId,
                    error: error.message
                });
            }

            // Notificar a la Strategy que el QR está disponible
            // Esto resuelve la promesa waitForQR() si alguien está esperando
            if (context.notifyQRAvailable) {
                context.notifyQRAvailable(base64QR);
                this.logger.debug('WhatsAppEventHandler', 'Strategy notified of QR availability', {
                    connectionId
                });
            }

            // Emitir QR específicamente al tenant
            this.webSocketAdapter.emitQRToTenant(tenantId, {
                qr: base64QR,
                tenantId,
                clientId: connectionId,
                attempts: this.qrAttempts,
                maxAttempts: this.maxQrAttempts
            });

        } catch (error) {
            this.logger.error('WhatsAppEventHandler', 'Error handling QR event', error, {
                connectionId
            });
        }
    }

    /**
     * Maneja el evento Ready
     * @param {Object} context - Contexto de la conexión
     */
    async handleReadyEvent(context) {
        const { connectionId, tenantId, getDeviceInfo, resetQRAttempts, whatsappConnection } = context;

        try {
            this.logger.info('WhatsAppEventHandler', 'WhatsApp client ready event triggered', {
                connectionId
            });

            // Limpiar timeout y reiniciar contadores al conectarse exitosamente
            this.resetQRAttempts();
            if (resetQRAttempts) {
                resetQRAttempts();
            }

            // Obtener información del dispositivo
            const deviceInfo = await getDeviceInfo();

            // Actualizar registro de conexión principal
            await this.connectionRepository.updateStatus(connectionId, 'active');

            // Actualizar registro de WhatsApp Connection
            await this.whatsappConnectionRepository.update(connectionId, {
                status: 'connected',
                qrCode: null,
                deviceInfo: deviceInfo,
                phoneNumber: deviceInfo?.phoneNumber || null,
                lastSeen: new Date()
            });

            // Reiniciar intentos de conexión
            if (whatsappConnection && whatsappConnection.resetConnectionAttempts) {
                await whatsappConnection.resetConnectionAttempts();
            }

            this.logger.info('WhatsAppEventHandler', 'WhatsApp client ready', {
                connectionId,
                phoneNumber: deviceInfo?.phoneNumber || null
            });

            // Emitir evento de ready al frontend
            this.webSocketAdapter.emitToTenant(tenantId, 'whatsappReady', {
                clientId: connectionId,
                tenantId,
                phoneNumber: deviceInfo?.phoneNumber || null,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            this.logger.error('WhatsAppEventHandler', 'Error handling ready event', error, {
                connectionId
            });
            throw error;
        }
    }

    /**
     * Maneja el evento Authenticated
     * @param {Object} session - Sesión autenticada
     * @param {Object} context - Contexto de la conexión
     */
    async handleAuthenticatedEvent(session, context) {
        const { connectionId, tenantId, resetQRAttempts } = context;

        try {
            this.logger.info('WhatsAppEventHandler', 'WhatsApp client authenticated event triggered', {
                connectionId
            });

            // Limpiar timeout y reiniciar contadores
            this.resetQRAttempts();
            if (resetQRAttempts) {
                resetQRAttempts();
            }

            // Actualizar estado a 'connecting' (proceso de autenticación iniciado)
            await this.connectionRepository.updateStatus(connectionId, 'connecting');
            await this.whatsappConnectionRepository.update(connectionId, {
                status: 'connecting'
            });

            this.logger.info('WhatsAppEventHandler', 'Session authenticated - Status changed to connecting', {
                connectionId
            });

            // Emitir evento 'authenticated' al frontend via WebSocket
            this.webSocketAdapter.emitToTenant(tenantId, 'authenticated', {
                connectionId,
                clientId: connectionId,
                tenantId,
                status: 'connecting',
                message: 'Autenticación exitosa, conectando...',
                timestamp: new Date().toISOString()
            });

            this.logger.info('WhatsAppEventHandler', 'Authenticated event emitted to tenant via WebSocket', {
                connectionId,
                tenantId
            });

        } catch (error) {
            this.logger.error('WhatsAppEventHandler', 'Error handling authenticated event', error, {
                connectionId
            });
            throw error;
        }
    }

    /**
     * Maneja el evento Auth Failure
     * @param {string} msg - Mensaje de error
     * @param {Object} context - Contexto de la conexión
     */
    async handleAuthFailureEvent(msg, context) {
        const { connectionId, tenantId, clearSession } = context;

        try {
            this.logger.error('WhatsAppEventHandler', 'Authentication failed', null, {
                connectionId,
                message: msg
            });

            // Actualizar estado a 'inactive' (autenticación fallida)
            await this.connectionRepository.updateStatus(connectionId, 'inactive');
            await this.whatsappConnectionRepository.update(connectionId, {
                status: 'inactive',
                lastError: msg
            });

            this.logger.warn('WhatsAppEventHandler', 'Auth failure - Status changed to inactive', {
                connectionId,
                error: msg
            });

            // Emitir evento de fallo de autenticación al frontend
            this.webSocketAdapter.emitToTenant(tenantId, 'auth_failure', {
                connectionId,
                clientId: connectionId,
                tenantId,
                status: 'inactive',
                message: msg || 'Falló la autenticación',
                timestamp: new Date().toISOString()
            });

            // Limpiar sesión
            if (clearSession) {
                await clearSession();
            }

        } catch (error) {
            this.logger.error('WhatsAppEventHandler', 'Error handling auth failure event', error, {
                connectionId
            });
        }
    }

    /**
     * Maneja el evento Disconnected
     * @param {string} reason - Razón de la desconexión
     * @param {Object} context - Contexto de la conexión
     */
    async handleDisconnectedEvent(reason, context) {
        const { connectionId, tenantId } = context;

        try {
            this.logger.warn('WhatsAppEventHandler', 'Client disconnected', {
                connectionId,
                reason
            });

            // Actualizar estado en WhatsApp Connection
            await this.whatsappConnectionRepository.update(connectionId, {
                status: 'disconnected',
                lastError: reason
            });

            // Actualizar estado en Connection principal
            await this.connectionRepository.updateStatus(connectionId, 'inactive');

            // Emitir desconexión al tenant específico
            this.webSocketAdapter.emitConnectionStatusToTenant(tenantId, {
                status: 'disconnected',
                clientId: connectionId,
                reason,
                message: 'WhatsApp disconnected'
            });

        } catch (error) {
            this.logger.error('WhatsAppEventHandler', 'Error handling disconnected event', error, {
                connectionId
            });
        }
    }

    /**
     * Maneja el evento Loading Screen
     * @param {number} percent - Porcentaje de carga
     * @param {string} message - Mensaje de carga
     * @param {Object} context - Contexto de la conexión
     */
    handleLoadingScreenEvent(percent, message, context) {
        const { connectionId, tenantId } = context;

        this.logger.info('WhatsAppEventHandler', 'Loading screen', {
            connectionId,
            percent,
            message
        });

        // Emitir al frontend
        this.webSocketAdapter.emitToTenant(tenantId, 'loading_screen', {
            percent,
            message
        });
    }

    /**
     * Reinicia los intentos de QR
     */
    resetQRAttempts() {
        this.qrAttempts = 0;
        if (this.qrTimeoutTimer) {
            clearTimeout(this.qrTimeoutTimer);
            this.qrTimeoutTimer = null;
        }
        this.logger.info('WhatsAppEventHandler', 'QR attempts reset');
    }

    /**
     * Obtiene el número de intentos de QR actuales
     * @returns {number}
     */
    getQRAttempts() {
        return this.qrAttempts;
    }

    /**
     * Configura el timeout para QR
     * @param {Function} callback - Función a ejecutar cuando expire el timeout
     */
    setupQRTimeout(callback) {
        if (this.qrTimeoutTimer) {
            clearTimeout(this.qrTimeoutTimer);
        }

        this.qrTimeoutTimer = setTimeout(() => {
            this.logger.warn('WhatsAppEventHandler', 'QR timeout expired', {
                attempts: this.qrAttempts,
                maxAttempts: this.maxQrAttempts
            });

            if (callback && typeof callback === 'function') {
                callback();
            }
        }, this.qrTimeoutDuration);

        this.logger.info('WhatsAppEventHandler', 'QR timeout configured', {
            duration: this.qrTimeoutDuration
        });
    }
}

module.exports = WhatsAppEventHandler;