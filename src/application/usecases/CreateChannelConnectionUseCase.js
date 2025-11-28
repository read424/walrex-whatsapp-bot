const ChannelConnection = require('../../domain/model/ChannelConnection');
const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Crear una nueva conexión de canal
 *
 * Responsabilidad:
 * - Validar los datos de entrada del formulario
 * - Generar configuración específica del canal
 * - Verificar que no exista duplicado (nombre + tenant)
 * - Crear la conexión en la base de datos
 * - Para WhatsApp Web: generar clientId único
 * - Para Meta (Instagram/Facebook): configurar webhook
 *
 * Dependencias:
 * - channelConnectionRepository: Para persistir la conexión
 * - logger: Para registrar operaciones
 */
class CreateChannelConnectionUseCase {
    constructor({ channelConnectionRepository, logger }) {
        if (!channelConnectionRepository) {
            throw new Error('channelConnectionRepository is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.channelConnectionRepository = channelConnectionRepository;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso de creación de conexión
     *
     * @param {Object} params - Datos del formulario
     * @param {string} params.connectionName - Nombre de la conexión
     * @param {string} params.channelType - Tipo de canal
     * @param {number} params.tenantId - ID del tenant
     * @param {number} params.departmentId - ID del departamento
     * @param {string} params.welcomeMessage - Mensaje de saludo
     * @param {string} params.goodbyeMessage - Mensaje de despedida
     * @param {number} params.chatbotTimeout - Timeout para reinicio (minutos)
     * @param {Object} params.channelCredentials - Credenciales específicas del canal
     * @param {string} params.baseWebhookUrl - URL base para webhooks (opcional)
     *
     * @returns {Promise<Object>} - Conexión creada con información adicional
     */
    async execute({
        connectionName,
        channelType,
        tenantId,
        departmentId = null,
        welcomeMessage = null,
        goodbyeMessage = null,
        chatbotTimeout = 30,
        channelCredentials = {},
        baseWebhookUrl = null
    }) {
        const startTime = Date.now();

        this.logger.info('CreateChannelConnectionUseCase', 'Creating new channel connection', {
            connectionName,
            channelType,
            tenantId,
            departmentId
        });

        try {
            // 1. Validar datos básicos
            this.validateBasicInput({
                connectionName,
                channelType,
                tenantId,
                chatbotTimeout
            });

            // 2. Verificar que no exista conexión con el mismo nombre
            await this.checkDuplicateConnection(connectionName, tenantId);

            // 3. Preparar configuración específica del canal
            const channelConfig = await this.prepareChannelConfig(
                channelType,
                channelCredentials,
                tenantId
            );

            // 4. Crear entidad de dominio
            const connection = new ChannelConnection({
                connectionName,
                channelType,
                tenantId,
                departmentId,
                welcomeMessage,
                goodbyeMessage,
                chatbotTimeout,
                channelConfig,
                status: 'inactive',
                isActive: true
            });

            // 5. Validar entidad
            connection.validate();
            connection.validateChannelConfig();

            // 6. Persistir en base de datos
            const savedConnection = await this.channelConnectionRepository.create(connection);

            this.logger.info('CreateChannelConnectionUseCase', 'Connection created successfully', {
                connectionId: savedConnection.id,
                channelType,
                duration: Date.now() - startTime
            });

            // 7. Preparar respuesta con información adicional
            const response = {
                success: true,
                data: savedConnection.toJSON(),
                message: 'Conexión creada exitosamente'
            };

            // 8. Si el canal requiere webhook, incluirlo en la respuesta
            if (savedConnection.requiresWebhook() && baseWebhookUrl) {
                response.webhookInfo = {
                    webhookUrl: this.generateWebhookUrl(savedConnection, baseWebhookUrl),
                    verifyToken: channelConfig.verifyToken || null,
                    instructions: this.getWebhookInstructions(channelType)
                };
            }

            // 9. Si es WhatsApp Web, incluir instrucciones de conexión
            if (channelType === 'whatsapp_web') {
                response.whatsappInfo = {
                    clientId: channelConfig.clientId,
                    instructions: 'Usa el endpoint /api/v2/connections/{id}/qr para obtener el código QR y conectar'
                };
            }

            return response;

        } catch (error) {
            this.logger.error('CreateChannelConnectionUseCase', 'Error creating connection', error, {
                connectionName,
                channelType,
                tenantId
            });
            throw error;
        }
    }

    /**
     * Valida los datos básicos de entrada
     * @private
     */
    validateBasicInput({ connectionName, channelType, tenantId, chatbotTimeout }) {
        if (!connectionName || connectionName.trim() === '') {
            throw new IllegalArgumentException('connectionName is required and cannot be empty');
        }

        if (connectionName.length > 100) {
            throw new IllegalArgumentException('connectionName cannot exceed 100 characters');
        }

        const validChannelTypes = [
            'whatsapp_web',
            'whatsapp_api',
            'instagram_direct',
            'facebook_messenger',
            'telegram',
            'webchat'
        ];

        if (!channelType || !validChannelTypes.includes(channelType)) {
            throw new IllegalArgumentException(
                `Invalid channelType. Must be one of: ${validChannelTypes.join(', ')}`
            );
        }

        if (!tenantId || typeof tenantId !== 'number') {
            throw new IllegalArgumentException('tenantId is required and must be a number');
        }

        if (chatbotTimeout && (chatbotTimeout < 1 || chatbotTimeout > 1440)) {
            throw new IllegalArgumentException('chatbotTimeout must be between 1 and 1440 minutes');
        }
    }

    /**
     * Verifica que no exista una conexión con el mismo nombre
     * @private
     */
    async checkDuplicateConnection(connectionName, tenantId) {
        const existing = await this.channelConnectionRepository.findByNameAndTenant(
            connectionName,
            tenantId
        );

        if (existing) {
            throw new IllegalArgumentException(
                `Ya existe una conexión con el nombre "${connectionName}" para este tenant`
            );
        }
    }

    /**
     * Prepara la configuración específica del canal
     * @private
     */
    async prepareChannelConfig(channelType, credentials, tenantId) {
        const config = {};

        switch (channelType) {
            case 'whatsapp_web':
                config.clientId = this.generateClientId(tenantId);
                config.sessionPath = `/sessions/${config.clientId}`;
                break;

            case 'whatsapp_api':
                this.validateWhatsAppApiCredentials(credentials);
                config.accessToken = credentials.accessToken;
                config.phoneNumberId = credentials.phoneNumberId;
                config.businessAccountId = credentials.businessAccountId;
                config.webhookVerifyToken = credentials.verifyToken;
                config.apiVersion = credentials.apiVersion || 'v18.0';
                break;

            case 'instagram_direct':
                this.validateSocialMediaCredentials(credentials);
                config.accessToken = credentials.accessToken;
                config.verifyToken = credentials.verifyToken;
                config.instagramAccountId = credentials.instagramAccountId;
                config.pageId = credentials.pageId;
                break;

            case 'facebook_messenger':
                this.validateSocialMediaCredentials(credentials);
                config.accessToken = credentials.accessToken;
                config.verifyToken = credentials.verifyToken;
                config.pageId = credentials.pageId;
                config.pageAccessToken = credentials.pageAccessToken;
                break;

            case 'telegram':
                this.validateTelegramCredentials(credentials);
                config.botToken = credentials.botToken;
                config.botUsername = credentials.botUsername;
                config.allowedUpdates = credentials.allowedUpdates || ['message', 'callback_query'];
                break;

            case 'webchat':
                config.apiToken = this.generateApiToken();
                config.widgetId = this.generateWidgetId(tenantId);
                config.allowedOrigins = credentials.allowedOrigins || [];
                config.customization = credentials.customization || {};
                break;

            default:
                throw new IllegalArgumentException(`Unsupported channel type: ${channelType}`);
        }

        return config;
    }

    /**
     * Valida credenciales de WhatsApp API
     * @private
     */
    validateWhatsAppApiCredentials(credentials) {
        if (!credentials.accessToken) {
            throw new IllegalArgumentException('accessToken is required for WhatsApp API');
        }
        if (!credentials.phoneNumberId) {
            throw new IllegalArgumentException('phoneNumberId is required for WhatsApp API');
        }
        if (!credentials.verifyToken) {
            throw new IllegalArgumentException('verifyToken is required for WhatsApp API');
        }
    }

    /**
     * Valida credenciales de redes sociales (Instagram/Facebook)
     * @private
     */
    validateSocialMediaCredentials(credentials) {
        if (!credentials.accessToken) {
            throw new IllegalArgumentException('accessToken (PAGE_ACCESS_TOKEN) is required');
        }
        if (!credentials.verifyToken) {
            throw new IllegalArgumentException('verifyToken (VERIFY_TOKEN) is required');
        }
    }

    /**
     * Valida credenciales de Telegram
     * @private
     */
    validateTelegramCredentials(credentials) {
        if (!credentials.botToken) {
            throw new IllegalArgumentException('botToken is required for Telegram');
        }
    }

    /**
     * Genera un clientId único para WhatsApp Web
     * @private
     */
    generateClientId(tenantId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `client-${tenantId}-${timestamp}-${random}`;
    }

    /**
     * Genera un token API para WebChat
     * @private
     */
    generateApiToken() {
        const crypto = require('crypto');
        return `wc_${crypto.randomBytes(32).toString('hex')}`;
    }

    /**
     * Genera un ID de widget para WebChat
     * @private
     */
    generateWidgetId(tenantId) {
        const random = Math.random().toString(36).substring(2, 10);
        return `widget_${tenantId}_${random}`;
    }

    /**
     * Genera la URL del webhook
     * @private
     */
    generateWebhookUrl(connection, baseUrl) {
        const paths = {
            'whatsapp_api': '/webhook/whatsapp',
            'instagram_direct': '/webhook/instagram',
            'facebook_messenger': '/webhook/facebook',
            'telegram': '/webhook/telegram'
        };

        const path = paths[connection.channelType];
        if (!path) return null;

        return `${baseUrl}${path}/${connection.id}`;
    }

    /**
     * Obtiene instrucciones para configurar el webhook
     * @private
     */
    getWebhookInstructions(channelType) {
        const instructions = {
            'instagram_direct': 'Configura este webhook en el Portal de Desarrolladores de Facebook > Tu App > Productos > Webhooks > Instagram',
            'facebook_messenger': 'Configura este webhook en el Portal de Desarrolladores de Facebook > Tu App > Productos > Webhooks > Messenger',
            'whatsapp_api': 'Configura este webhook en el Portal de WhatsApp Business API > Configuración',
            'telegram': 'El webhook se configurará automáticamente al activar la conexión'
        };

        return instructions[channelType] || 'Configura el webhook según la documentación del proveedor';
    }
}

module.exports = CreateChannelConnectionUseCase;