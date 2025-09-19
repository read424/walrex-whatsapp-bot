const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');

class Connection extends Model {}

Connection.init({
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
    provider_type: {
        type: DataTypes.ENUM('whatsapp', 'facebook', 'instagram', 'telegram', 'whatsapp_api', 'chatweb'),
        allowNull: false,
        comment: 'Tipo de proveedor de mensajería'
    },
    department: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Departamento asignado (Ventas, Marketing, etc.)'
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
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'error', 'connecting'),
        allowNull: false,
        defaultValue: 'inactive',
        comment: 'Estado actual de la conexión'
    },
    tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Identificador del tenant para multitenancy'
    },
    settings: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Configuraciones adicionales específicas del proveedor'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si la conexión está activa o no'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'Connection',
    tableName: 'connections',
    timestamps: false,
    indexes: [
        {
            fields: ['tenant_id']
        },
        {
            fields: ['provider_type']
        },
        {
            fields: ['status']
        },
        {
            unique: true,
            fields: ['connection_name', 'tenant_id']
        }
    ]
});

// Métodos de instancia útiles
Connection.prototype.updateStatus = async function(newStatus) {
    this.status = newStatus;
    this.updated_at = new Date();
    return await this.save();
};

Connection.prototype.isWhatsApp = function() {
    return this.provider_type === 'whatsapp';
};

Connection.prototype.isSocialMedia = function() {
    return ['facebook', 'instagram'].includes(this.provider_type);
};

// Métodos estáticos
Connection.getActiveConnectionsByTenant = async function(tenantId) {
    return await this.findAll({
        where: {
            tenant_id: tenantId,
            is_active: true,
            status: 'active'
        },
        order: [['created_at', 'ASC']]
    });
};

Connection.getConnectionsByProvider = async function(providerType, tenantId = null) {
    const where = { provider_type: providerType };
    if (tenantId) {
        where.tenant_id = tenantId;
    }
    
    return await this.findAll({
        where,
        order: [['created_at', 'ASC']]
    });
};

module.exports = Connection;