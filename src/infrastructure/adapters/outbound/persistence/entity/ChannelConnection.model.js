const { Model, DataTypes } = require('sequelize');
const sequelize = require('../../../../config/DatabaseConfig');

/**
 * Modelo unificado para todas las conexiones de canales de comunicación
 * Soporta: WhatsApp Web, WhatsApp API, Instagram, Facebook Messenger, Telegram, WebChat
 */
class ChannelConnection extends Model {
    static associate(models) {
        // Una conexión puede tener muchas sesiones de chat
        ChannelConnection.hasMany(models.ChatSession, {
            foreignKey: 'connection_id',
            sourceKey: 'id',
            as: 'chatSessions'
        });

        // Relación con Department si existe el modelo
        if (models.Department) {
            ChannelConnection.belongsTo(models.Department, {
                foreignKey: 'department_id',
                as: 'department'
            });
        }
    }
}

ChannelConnection.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    connection_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Nombre descriptivo de la conexión (ej: WhatsApp Ventas Principal)'
    },
    channel_type: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: {
            isIn: [[
                'whatsapp_web',
                'whatsapp_api',
                'instagram_direct',
                'facebook_messenger',
                'telegram',
                'webchat'
            ]]
        },
        comment: 'Tipo de canal de comunicación'
    },
    tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID del tenant para multitenancy'
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'inactive',
        validate: {
            isIn: [[
                'active',
                'inactive',
                'connecting',
                'qr_generated',
                'disconnected',
                'authenticated',
                'error'
            ]]
        },
        comment: 'Estado actual de la conexión'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si la conexión está habilitada o no'
    },
    department_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del departamento asignado (Ventas, Soporte, etc.)'
    },
    welcome_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mensaje de saludo personalizado'
    },
    goodbye_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mensaje de despedida personalizado'
    },
    chatbot_timeout: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 30,
        comment: 'Tiempo en minutos para reinicio del chatbot'
    },
    channel_config: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Configuración específica del canal (credenciales, tokens, etc.)'
    },
    connection_metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Metadata de la conexión (último QR, estadísticas, etc.)'
    },
    last_seen: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Última actividad detectada en la conexión'
    },
    last_error: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Último error registrado'
    },
    connection_attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Número de intentos de reconexión'
    }
}, {
    sequelize,
    modelName: 'ChannelConnection',
    tableName: 'channel_connections',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['tenant_id']
        },
        {
            fields: ['channel_type']
        },
        {
            fields: ['status']
        },
        {
            fields: ['is_active']
        },
        {
            unique: true,
            fields: ['connection_name', 'tenant_id']
        },
        {
            fields: ['tenant_id', 'channel_type', 'status', 'is_active'],
            name: 'idx_channel_connections_tenant_channel_status_active'
        },
        {
            using: 'GIN',
            fields: ['channel_config'],
            name: 'idx_channel_connections_config_gin'
        },
        {
            using: 'GIN',
            fields: ['connection_metadata'],
            name: 'idx_channel_connections_metadata_gin'
        }
    ]
});

// ==================== MÉTODOS DE INSTANCIA ====================

/**
 * Actualiza el estado de la conexión
 */
ChannelConnection.prototype.updateStatus = async function (newStatus, error = null) {
    this.status = newStatus;
    this.last_seen = new Date();
    if (error) {
        this.last_error = error;
        this.connection_attempts += 1;
    }
    return await this.save();
};

/**
 * Reinicia los intentos de conexión
 */
ChannelConnection.prototype.resetConnectionAttempts = async function () {
    this.connection_attempts = 0;
    this.last_error = null;
    return await this.save();
};

/**
 * Actualiza la metadata de la conexión (reemplaza completamente)
 */
ChannelConnection.prototype.updateMetadata = async function (metadata) {
    this.connection_metadata = {
        ...this.connection_metadata,
        ...metadata,
        lastUpdate: new Date().toISOString()
    };
    return await this.save();
};

/**
 * Agrega metadata sin sobrescribir la existente (método preferido)
 */
ChannelConnection.prototype.appendMetadata = async function (newMetadata) {
    this.connection_metadata = {
        ...this.connection_metadata,
        ...newMetadata,
        lastUpdate: new Date().toISOString()
    };
    return await this.save();
};

/**
 * Verifica si es una conexión de WhatsApp
 */
ChannelConnection.prototype.isWhatsApp = function () {
    return this.channel_type === 'whatsapp_web' || this.channel_type === 'whatsapp_api';
};

/**
 * Verifica si es una conexión de redes sociales (Meta)
 */
ChannelConnection.prototype.isSocialMedia = function () {
    return ['instagram_direct', 'facebook_messenger'].includes(this.channel_type);
};

/**
 * Obtiene configuración específica del canal
 */
ChannelConnection.prototype.getChannelConfig = function () {
    return this.channel_config || {};
};

/**
 * Actualiza configuración del canal
 */
ChannelConnection.prototype.updateChannelConfig = async function (config) {
    this.channel_config = {
        ...this.channel_config,
        ...config
    };
    return await this.save();
};

/**
 * Genera el webhook URL para canales que lo requieran
 */
ChannelConnection.prototype.getWebhookUrl = function (baseUrl) {
    const webhookPaths = {
        'whatsapp_api': '/webhook/whatsapp',
        'instagram_direct': '/webhook/instagram',
        'facebook_messenger': '/webhook/facebook',
        'telegram': '/webhook/telegram'
    };

    const path = webhookPaths[this.channel_type];
    if (!path) return null;

    return `${baseUrl}${path}/${this.id}`;
};

// ==================== MÉTODOS ESTÁTICOS ====================

/**
 * Obtiene todas las conexiones activas de un tenant
 */
ChannelConnection.getActiveConnectionsByTenant = async function (tenantId) {
    return await this.findAll({
        where: {
            tenant_id: tenantId,
            is_active: true,
            status: ['active', 'authenticated']
        },
        order: [['created_at', 'DESC']]
    });
};

/**
 * Busca una conexión por nombre y tenant (método principal para obtener conexiones)
 */
ChannelConnection.findByConnectionName = async function (connectionName, tenantId) {
    return await this.findOne({
        where: {
            connection_name: connectionName,
            tenant_id: tenantId,
            is_active: true
        }
    });
};

/**
 * Obtiene una conexión por ID (para compatibilidad con código legacy)
 */
ChannelConnection.getConnectionById = async function (connectionId) {
    return await this.findByPk(connectionId);
};

/**
 * Obtiene conexiones por tipo de canal
 */
ChannelConnection.getConnectionsByChannelType = async function (channelType, tenantId = null) {
    const where = {
        channel_type: channelType,
        is_active: true
    };

    if (tenantId) {
        where.tenant_id = tenantId;
    }

    return await this.findAll({
        where,
        order: [['created_at', 'DESC']]
    });
};

/**
 * Busca una conexión por nombre y tenant
 */
ChannelConnection.findByNameAndTenant = async function (connectionName, tenantId) {
    return await this.findOne({
        where: {
            connection_name: connectionName,
            tenant_id: tenantId
        }
    });
};

/**
 * Obtiene conexiones que necesitan reconexión
 */
ChannelConnection.getConnectionsNeedingReconnect = async function (maxAttempts = 5) {
    return await this.findAll({
        where: {
            status: ['error', 'disconnected'],
            is_active: true,
            connection_attempts: {
                [sequelize.Sequelize.Op.lt]: maxAttempts
            }
        },
        order: [['connection_attempts', 'ASC'], ['updated_at', 'ASC']]
    });
};

/**
 * Cuenta conexiones por tipo de canal
 */
ChannelConnection.countByChannelType = async function (tenantId) {
    return await this.findAll({
        attributes: [
            'channel_type',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
            tenant_id: tenantId,
            is_active: true
        },
        group: ['channel_type'],
        raw: true
    });
};

module.exports = ChannelConnection;