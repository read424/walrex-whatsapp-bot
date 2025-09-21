const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');

class ChatSession extends Model {
    static associate(models){
        // Una sesión pertenece a un contacto
        ChatSession.belongsTo(models.Contact, {
            foreignKey: 'contact_id',
            targetKey: 'id'
        });

        // Una sesión pertenece a una conexión
        ChatSession.belongsTo(models.Connection, {
            foreignKey: 'connection_id',
            targetKey: 'id'
        });

        // Una sesión puede ser manejada por un asesor
        ChatSession.belongsTo(models.Advisor, {
            foreignKey: 'handled_by',
            targetKey: 'id'
        });

        // Una sesión tiene muchos mensajes
        ChatSession.hasMany(models.ChatMessage, {
            foreignKey: 'chat_session_id',
            sourceKey: 'id'
        });
    }
}

ChatSession.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    contact_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'contacts',
            key: 'id'
        },
        comment: 'ID del contacto asociado'
    },
    connection_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'whatsapp_connections',
            key: 'id'
        },
        comment: 'ID de la conexión WhatsApp'
    },
    started_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Momento de inicio de la sesión'
    },
    ended_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Momento de finalización de la sesión'
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        validate: {
            isIn: [['active', 'closed', 'transferred']]
        },
        comment: 'Estado de la sesión'
    },
    handled_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'advisors',
            key: 'id'
        },
        comment: 'ID del asesor que maneja la sesión'
    },
    tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Identificador del tenant para multitenancy'
    },
    metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Información adicional de la sesión como origen, prioridad, etc.'
    }
}, { 
    sequelize, 
    modelName: 'ChatSession', 
    tableName: 'chat_sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['contact_id'],
            name: 'idx_chat_sessions_contact_id'
        },
        {
            fields: ['connection_id'],
            name: 'idx_chat_sessions_connection_id'
        },
        {
            fields: ['status'],
            name: 'idx_chat_sessions_status'
        }
    ]
});

// Métodos de instancia útiles
ChatSession.prototype.isActive = function() {
    return this.status === 'active';
};

ChatSession.prototype.isClosed = function() {
    return this.status === 'closed';
};

ChatSession.prototype.close = async function() {
    this.status = 'closed';
    this.ended_at = new Date();
    return await this.save();
};

ChatSession.prototype.assignToAdvisor = async function(advisorId) {
    this.handled_by = advisorId;
    return await this.save();
};

ChatSession.prototype.getDuration = function() {
    if (!this.ended_at) {
        return null;
    }
    return this.ended_at - this.started_at;
};

// Métodos estáticos
ChatSession.findActiveByTenant = async function(tenantId) {
    return await this.findAll({
        where: {
            tenant_id: tenantId,
            status: 'active'
        },
        order: [['started_at', 'DESC']]
    });
};

ChatSession.findByContact = async function(contactId) {
    return await this.findAll({
        where: { contact_id: contactId },
        order: [['started_at', 'DESC']]
    });
};

ChatSession.createSession = async function(sessionData) {
    const session = await this.create({
        ...sessionData,
        status: 'active',
        started_at: new Date()
    });
    return session;
};

module.exports = ChatSession;