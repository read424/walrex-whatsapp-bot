/**
 * Controller v2 para gestión de conexiones de canales unificadas
 *
 * Endpoints:
 * - POST /api/v2/connections - Crear nueva conexión
 * - GET /api/v2/connections - Listar conexiones del tenant
 * - GET /api/v2/connections/:id - Obtener detalles de conexión
 * - PUT /api/v2/connections/:id - Actualizar conexión
 * - DELETE /api/v2/connections/:id - Eliminar conexión
 * - GET /api/v2/connections/:id/qr - Obtener QR de WhatsApp (solo whatsapp_web)
 * - POST /api/v2/connections/:id/activate - Activar conexión
 * - POST /api/v2/connections/:id/deactivate - Desactivar conexión
 */
class ChannelConnectionController {
    constructor({
        createChannelConnectionUseCase,
        getChannelConnectionsUseCase,
        getWhatsAppQRCodeUseCase,
        logger
    }) {
        if (!createChannelConnectionUseCase) {
            throw new Error('createChannelConnectionUseCase is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.createChannelConnectionUseCase = createChannelConnectionUseCase;
        this.getChannelConnectionsUseCase = getChannelConnectionsUseCase;
        this.getWhatsAppQRCodeUseCase = getWhatsAppQRCodeUseCase;
        this.logger = logger;
    }

    /**
     * POST /api/v2/connections
     * Crea una nueva conexión de canal
     */
    async createConnection(req, res) {
        const correlationId = req.correlationId || 'unknown';

        try {
            this.logger.info('ChannelConnectionController', 'Create connection request', {
                correlationId,
                body: {
                    ...req.body,
                    // Ocultar credenciales en logs
                    channelCredentials: req.body.channelCredentials ? '***' : undefined
                }
            });

            // Extraer datos del formulario
            const {
                connectionName,
                channelType,
                departmentId,
                welcomeMessage,
                goodbyeMessage,
                chatbotTimeout,
                // Credenciales específicas del canal
                channelCredentials
            } = req.body;

            // El tenantId viene del middleware extractTenantId (req.user.tenantId)
            const tenantId = req.user?.tenantId;

            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    message: 'X-Tenant-Id header is required'
                });
            }

            // Validar credenciales según el tipo de canal
            const validatedCredentials = this.validateAndExtractCredentials(
                channelType,
                channelCredentials
            );

            // Obtener URL base para webhooks
            const baseWebhookUrl = this.getBaseWebhookUrl(req);

            // Ejecutar caso de uso
            const result = await this.createChannelConnectionUseCase.execute({
                connectionName,
                channelType,
                tenantId,
                departmentId,
                welcomeMessage,
                goodbyeMessage,
                chatbotTimeout,
                channelCredentials: validatedCredentials,
                baseWebhookUrl
            });

            this.logger.info('ChannelConnectionController', 'Connection created successfully', {
                correlationId,
                connectionId: result.data.id,
                channelType
            });

            return res.status(201).json(result);

        } catch (error) {
            this.logger.error('ChannelConnectionController', 'Error creating connection', error, {
                correlationId
            });

            const statusCode = error.message.includes('required') ||
                               error.message.includes('Invalid') ||
                               error.message.includes('Ya existe') ? 400 : 500;

            return res.status(statusCode).json({
                success: false,
                message: error.message || 'Error al crear la conexión',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    /**
     * GET /api/v2/connections
     * Lista las conexiones del tenant
     */
    async listConnections(req, res) {
        const correlationId = req.correlationId || 'unknown';

        try {
            // El tenantId viene del middleware extractTenantId
            const tenantId = req.user?.tenantId;
            const {
                channelType,
                status,
                isActive,
                departmentId,
                page = 1,
                limit = 20
            } = req.query;

            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    message: 'X-Tenant-Id header is required'
                });
            }

            this.logger.info('ChannelConnectionController', 'List connections request', {
                correlationId,
                tenantId,
                filters: { channelType, status, isActive, departmentId },
                pagination: { page, limit }
            });

            // Ejecutar caso de uso
            const result = await this.getChannelConnectionsUseCase.execute({
                tenantId,
                channelType,
                status,
                isActive,
                departmentId,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10)
            });

            this.logger.info('ChannelConnectionController', 'Connections listed successfully', {
                correlationId,
                totalReturned: result.data.connections.length
            });

            return res.status(200).json(result);

        } catch (error) {
            this.logger.error('ChannelConnectionController', 'Error listing connections', error, {
                correlationId
            });

            const statusCode = error.message.includes('Invalid') ||
                               error.message.includes('required') ||
                               error.message.includes('must be') ? 400 : 500;

            return res.status(statusCode).json({
                success: false,
                message: error.message || 'Error al listar conexiones',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    /**
     * GET /api/v2/connections/:id
     * Obtiene detalles de una conexión
     */
    async getConnection(req, res) {
        const correlationId = req.correlationId || 'unknown';
        const { id } = req.params;

        try {
            this.logger.info('ChannelConnectionController', 'Get connection request', {
                correlationId,
                connectionId: id
            });

            // TODO: Implementar caso de uso GetChannelConnectionUseCase

            return res.status(501).json({
                success: false,
                message: 'Get connection endpoint not implemented yet'
            });

        } catch (error) {
            this.logger.error('ChannelConnectionController', 'Error getting connection', error, {
                correlationId,
                connectionId: id
            });

            return res.status(500).json({
                success: false,
                message: error.message || 'Error al obtener la conexión'
            });
        }
    }

    /**
     * GET /api/v2/connections/:id/qr
     * Obtiene el código QR para WhatsApp Web
     */
    async getWhatsAppQR(req, res) {
        const correlationId = req.correlationId || 'unknown';
        const { id } = req.params;

        try {
            // El tenantId viene del middleware extractTenantId
            const tenantId = req.user?.tenantId;
            const forceRegenerate = req.query.forceRegenerate === 'true';

            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    message: 'X-Tenant-Id header is required'
                });
            }

            this.logger.info('ChannelConnectionController', 'Get WhatsApp QR request', {
                correlationId,
                connectionId: id,
                tenantId,
                forceRegenerate
            });

            // Ejecutar caso de uso
            const result = await this.getWhatsAppQRCodeUseCase.GetWhatsAppQRCode({
                connectionId: parseInt(id, 10),
                tenantId,
                forceRegenerate
            });

            this.logger.info('ChannelConnectionController', 'WhatsApp QR retrieved', {
                correlationId,
                connectionId: id,
                success: result.success
            });

            // Si el QR no está disponible aún, retornar 202 Accepted
            if (!result.success && result.data?.retryAfter) {
                return res.status(202).json(result);
            }

            // Si ya está autenticado, retornar 200 con información
            if (result.data?.status === 'authenticated') {
                return res.status(200).json(result);
            }

            // QR disponible, retornar 200
            return res.status(200).json(result);

        } catch (error) {
            this.logger.error('ChannelConnectionController', 'Error getting QR', error, {
                correlationId,
                connectionId: id
            });

            const statusCode = error.message.includes('not found') ? 404 :
                               error.message.includes('permission') ? 403 :
                               error.message.includes('only available') ? 400 :
                               error.message.includes('Invalid') ? 400 : 500;

            return res.status(statusCode).json({
                success: false,
                message: error.message || 'Error al obtener código QR',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // ==================== MÉTODOS PRIVADOS ====================

    /**
     * Valida y extrae las credenciales según el tipo de canal
     * @private
     */
    validateAndExtractCredentials(channelType, credentials) {
        if (!credentials) {
            return {};
        }

        switch (channelType) {
            case 'whatsapp_web':
                // WhatsApp Web no requiere credenciales del usuario
                // El clientId se genera automáticamente
                return {};

            case 'whatsapp_api':
                return {
                    accessToken: credentials.accessToken || credentials.pageAccessToken,
                    phoneNumberId: credentials.phoneNumberId,
                    businessAccountId: credentials.businessAccountId,
                    verifyToken: credentials.verifyToken,
                    apiVersion: credentials.apiVersion
                };

            case 'instagram_direct':
                return {
                    accessToken: credentials.accessToken || credentials.pageAccessToken,
                    verifyToken: credentials.verifyToken,
                    instagramAccountId: credentials.instagramAccountId,
                    pageId: credentials.pageId
                };

            case 'facebook_messenger':
                return {
                    accessToken: credentials.accessToken || credentials.pageAccessToken,
                    verifyToken: credentials.verifyToken,
                    pageId: credentials.pageId,
                    pageAccessToken: credentials.pageAccessToken
                };

            case 'telegram':
                return {
                    botToken: credentials.botToken,
                    botUsername: credentials.botUsername,
                    allowedUpdates: credentials.allowedUpdates
                };

            case 'webchat':
                return {
                    allowedOrigins: credentials.allowedOrigins,
                    customization: credentials.customization
                };

            default:
                return credentials;
        }
    }

    /**
     * Obtiene la URL base para webhooks
     * @private
     */
    getBaseWebhookUrl(req) {
        // Preferir variable de entorno si está configurada
        if (process.env.WEBHOOK_BASE_URL) {
            return process.env.WEBHOOK_BASE_URL;
        }

        // Construir desde la request
        const protocol = req.protocol;
        const host = req.get('host');
        return `${protocol}://${host}`;
    }
}

module.exports = ChannelConnectionController;