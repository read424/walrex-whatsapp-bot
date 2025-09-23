const { Model, DataTypes, Op } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');
const Connection = require('./Connection.model');

class WhatsAppConnection extends Model {}

WhatsAppConnection.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    clientId: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        field: 'client_id'
    },
    tenantId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'tenant_id'
    },
    phoneNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'phone_number'
    },
    // sessionData removido - whatsapp-web.js maneja sesiones automáticamente en filesystem
    status: {
        type: DataTypes.ENUM('disconnected', 'connecting', 'connected', 'authenticated', 'error'),
        allowNull: false,
        defaultValue: 'disconnected'
    },
    lastSeen: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_seen'
    },
    qrCode: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'qr_code'
    },
    deviceInfo: {
        type: DataTypes.JSONB, // JSONB es más eficiente en PostgreSQL
        allowNull: true,
        field: 'device_info'
    },
    connectionAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'connection_attempts'
    },
    lastError: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'last_error'
    },
    settings: {
        type: DataTypes.JSONB, // JSONB es más eficiente en PostgreSQL
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active'
    },
    connectionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'connection_id'
    }
}, {
    sequelize,
    modelName: 'WhatsAppConnection',
    tableName: 'whatsapp_connections',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Métodos de instancia
WhatsAppConnection.prototype.updateStatus = async function(status, error = null) {
    this.status = status;
    this.lastSeen = new Date();
    if (error) {
      this.lastError = error;
    }
    await this.save();
};

WhatsAppConnection.prototype.incrementConnectionAttempts = async function() {
    this.connectionAttempts += 1;
    await this.save();
};

WhatsAppConnection.prototype.resetConnectionAttempts = async function() {
    this.connectionAttempts = 0;
    this.lastError = null;
    await this.save();
};

// Métodos estáticos
WhatsAppConnection.getActiveConnections = async function() {
    return await this.findAll({
        where: {
            isActive: true,
            status: ['connected', 'authenticated']
        },
        order: [['updatedAt', 'DESC']]
    });
};

WhatsAppConnection.getConnectionByClientId = async function(clientId) {
    return await this.findOne({
        where: {
            clientId: clientId,
            isActive: true
        }
    });
};

WhatsAppConnection.getConnectionByName = async function(name) {
    return await this.findOne({
        where: {
            clientId: name,
            isActive: true
        }
    })
};

WhatsAppConnection.cleanupOldSessions = async function(daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await this.destroy({
        where: {
            updatedAt: {
                [Op.lt]: cutoffDate
            },
            status: 'disconnected'
            }
    });
};

// Establecer la relación
WhatsAppConnection.belongsTo(Connection, {
    as: 'connection',
    foreignKey: 'connection_id',
    constraints: true,
    targetKey: 'id'
});

Connection.hasOne(WhatsAppConnection, {
    as: 'whatsapp_details',
    foreignKey: 'connection_id',
    constraints: true,
    sourceKey: 'id'
});

module.exports = WhatsAppConnection;