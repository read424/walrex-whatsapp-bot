/**
 * Entidad de dominio ChannelConnection
 * Representa una conexión a un canal de comunicación (WhatsApp, Instagram, Facebook, etc.)
 */
class ChannelConnection {
    constructor({
        id,
        connectionName,
        channelType,
        tenantId,
        status = 'inactive',
        isActive = true,
        departmentId = null,
        welcomeMessage = null,
        goodbyeMessage = null,
        chatbotTimeout = 30,
        channelConfig = {},
        connectionMetadata = {},
        lastSeen = null,
        lastError = null,
        connectionAttempts = 0,
        createdAt = null,
        updatedAt = null
    }) {
        this.id = id;
        this.connectionName = connectionName;
        this.channelType = channelType;
        this.tenantId = tenantId;
        this.status = status;
        this.isActive = isActive;
        this.departmentId = departmentId;
        this.welcomeMessage = welcomeMessage;
        this.goodbyeMessage = goodbyeMessage;
        this.chatbotTimeout = chatbotTimeout;
        this.channelConfig = channelConfig;
        this.connectionMetadata = connectionMetadata;
        this.lastSeen = lastSeen;
        this.lastError = lastError;
        this.connectionAttempts = connectionAttempts;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    // ==================== VALIDACIONES ====================

    /**
     * Valida que los datos de la conexión sean válidos
     */
    validate() {
        const errors = [];

        if (!this.connectionName || this.connectionName.trim() === '') {
            errors.push('connectionName is required');
        }

        if (!this.channelType) {
            errors.push('channelType is required');
        }

        const validChannelTypes = [
            'whatsapp_web',
            'whatsapp_api',
            'instagram_direct',
            'facebook_messenger',
            'telegram',
            'webchat'
        ];

        if (!validChannelTypes.includes(this.channelType)) {
            errors.push(`Invalid channelType. Must be one of: ${validChannelTypes.join(', ')}`);
        }

        if (!this.tenantId) {
            errors.push('tenantId is required');
        }

        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * Valida configuración específica según el tipo de canal
     */
    validateChannelConfig() {
        const errors = [];

        switch (this.channelType) {
            case 'whatsapp_web':
                if (!this.channelConfig.clientId) {
                    errors.push('clientId is required for WhatsApp Web');
                }
                break;

            case 'whatsapp_api':
                if (!this.channelConfig.accessToken) {
                    errors.push('accessToken is required for WhatsApp API');
                }
                if (!this.channelConfig.phoneNumberId) {
                    errors.push('phoneNumberId is required for WhatsApp API');
                }
                break;

            case 'instagram_direct':
            case 'facebook_messenger':
                if (!this.channelConfig.accessToken) {
                    errors.push('accessToken is required for Meta platforms');
                }
                if (!this.channelConfig.verifyToken) {
                    errors.push('verifyToken is required for Meta platforms');
                }
                break;

            case 'telegram':
                if (!this.channelConfig.botToken) {
                    errors.push('botToken is required for Telegram');
                }
                break;

            case 'webchat':
                if (!this.channelConfig.apiToken) {
                    errors.push('apiToken is required for WebChat');
                }
                break;
        }

        if (errors.length > 0) {
            throw new Error(`Channel config validation failed: ${errors.join(', ')}`);
        }
    }

    // ==================== MÉTODOS DE NEGOCIO ====================

    /**
     * Verifica si la conexión está lista para usarse
     */
    isReady() {
        return this.isActive && ['active', 'authenticated'].includes(this.status);
    }

    /**
     * Verifica si es una conexión de WhatsApp
     */
    isWhatsApp() {
        return this.channelType === 'whatsapp_web' || this.channelType === 'whatsapp_api';
    }

    /**
     * Verifica si es una plataforma de Meta (Instagram/Facebook)
     */
    isSocialMedia() {
        return ['instagram_direct', 'facebook_messenger'].includes(this.channelType);
    }

    /**
     * Verifica si necesita webhook
     */
    requiresWebhook() {
        return [
            'whatsapp_api',
            'instagram_direct',
            'facebook_messenger',
            'telegram'
        ].includes(this.channelType);
    }

    /**
     * Actualiza el estado de la conexión
     */
    updateStatus(newStatus, error = null) {
        const validStatuses = ['active', 'inactive', 'connecting', 'disconnected', 'authenticated', 'error'];

        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status: ${newStatus}`);
        }

        this.status = newStatus;
        this.lastSeen = new Date();

        if (error) {
            this.lastError = error;
            this.connectionAttempts += 1;
        } else if (newStatus === 'active' || newStatus === 'authenticated') {
            // Limpiar errores al conectar exitosamente
            this.lastError = null;
            this.connectionAttempts = 0;
        }
    }

    /**
     * Actualiza metadata de la conexión
     */
    updateMetadata(metadata) {
        this.connectionMetadata = {
            ...this.connectionMetadata,
            ...metadata,
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * Marca la conexión como activa/inactiva
     */
    setActive(isActive) {
        this.isActive = isActive;
        if (!isActive) {
            this.status = 'inactive';
        }
    }

    // ==================== CONVERSIONES ====================

    /**
     * Convierte la entidad a objeto plano
     */
    toJSON() {
        return {
            id: this.id,
            connectionName: this.connectionName,
            channelType: this.channelType,
            tenantId: this.tenantId,
            status: this.status,
            isActive: this.isActive,
            departmentId: this.departmentId,
            welcomeMessage: this.welcomeMessage,
            goodbyeMessage: this.goodbyeMessage,
            chatbotTimeout: this.chatbotTimeout,
            channelConfig: this.channelConfig,
            connectionMetadata: this.connectionMetadata,
            lastSeen: this.lastSeen,
            lastError: this.lastError,
            connectionAttempts: this.connectionAttempts,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Convierte a formato de base de datos
     */
    toDatabase() {
        return {
            id: this.id,
            connection_name: this.connectionName,
            channel_type: this.channelType,
            tenant_id: this.tenantId,
            status: this.status,
            is_active: this.isActive,
            department_id: this.departmentId,
            welcome_message: this.welcomeMessage,
            goodbye_message: this.goodbyeMessage,
            chatbot_timeout: this.chatbotTimeout,
            channel_config: this.channelConfig,
            connection_metadata: this.connectionMetadata,
            last_seen: this.lastSeen,
            last_error: this.lastError,
            connection_attempts: this.connectionAttempts
        };
    }

    /**
     * Crea una instancia desde un objeto de base de datos
     */
    static fromDatabase(dbConnection) {
        if (!dbConnection) return null;

        return new ChannelConnection({
            id: dbConnection.id,
            connectionName: dbConnection.connection_name,
            channelType: dbConnection.channel_type,
            tenantId: dbConnection.tenant_id,
            status: dbConnection.status,
            isActive: dbConnection.is_active,
            departmentId: dbConnection.department_id,
            welcomeMessage: dbConnection.welcome_message,
            goodbyeMessage: dbConnection.goodbye_message,
            chatbotTimeout: dbConnection.chatbot_timeout,
            channelConfig: dbConnection.channel_config,
            connectionMetadata: dbConnection.connection_metadata,
            lastSeen: dbConnection.last_seen,
            lastError: dbConnection.last_error,
            connectionAttempts: dbConnection.connection_attempts,
            createdAt: dbConnection.created_at,
            updatedAt: dbConnection.updated_at
        });
    }

    /**
     * Factory method: Crea una conexión de WhatsApp Web
     */
    static createWhatsAppWeb({
        connectionName,
        tenantId,
        departmentId,
        welcomeMessage,
        goodbyeMessage,
        chatbotTimeout,
        clientId
    }) {
        return new ChannelConnection({
            connectionName,
            channelType: 'whatsapp_web',
            tenantId,
            departmentId,
            welcomeMessage,
            goodbyeMessage,
            chatbotTimeout,
            channelConfig: {
                clientId,
                sessionPath: `/sessions/${clientId}`
            },
            status: 'inactive'
        });
    }

    /**
     * Factory method: Crea una conexión de Instagram/Facebook
     */
    static createSocialMedia({
        connectionName,
        channelType, // 'instagram_direct' o 'facebook_messenger'
        tenantId,
        departmentId,
        welcomeMessage,
        goodbyeMessage,
        chatbotTimeout,
        accessToken,
        verifyToken
    }) {
        return new ChannelConnection({
            connectionName,
            channelType,
            tenantId,
            departmentId,
            welcomeMessage,
            goodbyeMessage,
            chatbotTimeout,
            channelConfig: {
                accessToken,
                verifyToken
            },
            status: 'inactive'
        });
    }
}

module.exports = ChannelConnection;