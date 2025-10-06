const { Model, DataTypes } = require('sequelize');  
const sequelize = require('../infrastructure/config/DatabaseConfig');

class ChatMessage extends Model {
    static associate(models){
        // Un mensaje pertenece a una sesión de chat
        ChatMessage.belongsTo(models.ChatSession, {
            foreignKey: 'chat_session_id',
            targetKey: 'id',
            as: 'chatSession'
        });

        // Un mensaje pertenece a un contacto
        ChatMessage.belongsTo(models.Contact, {
            foreignKey: 'contact_id',
            targetKey: 'id',
            as: 'contact'
        });

        // Un mensaje puede ser respondido por un asesor
        ChatMessage.belongsTo(models.Advisor, {
            foreignKey: 'responded_by',
            targetKey: 'id'
        });
    }
}

ChatMessage.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    chat_session_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'chat_sessions',
            key: 'id'
        },
        comment: 'ID de la sesión de chat'
    },
    contact_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'contacts',
            key: 'id'
        },
        comment: 'ID del contacto que envió el mensaje'
    },
    message_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'text',
        validate: {
            isIn: [['text', 'image', 'audio', 'video', 'document', 'location', 'contact']]
        },
        comment: 'Tipo de mensaje'
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Contenido del mensaje'
    },
    media_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'URL del archivo multimedia'
    },
    media_metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Metadatos del archivo (tamaño, tipo MIME, etc.)'
    },
    direction: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
            isIn: [['incoming', 'outgoing']]
        },
        comment: 'Dirección del mensaje'
    },
    whatsapp_message_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
        comment: 'ID único del mensaje de WhatsApp'
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'sent',
        validate: {
            isIn: [['sent', 'delivered', 'read', 'failed']]
        },
        comment: 'Estado del mensaje'
    },
    responded_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'advisors',
            key: 'id'
        },
        comment: 'ID del asesor que respondió'
    },
    responder_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'human',
        validate: {
            isIn: [['human', 'bot']]
        },
        comment: 'Tipo de respuesta (humano o bot)'
    },
    tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Identificador del tenant para multitenancy'
    }
}, { 
    sequelize, 
    modelName: 'ChatMessage', 
    tableName: 'chat_messages',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
        {
            fields: ['chat_session_id'],
            name: 'idx_chat_messages_session_id'
        },
        {
            fields: ['whatsapp_message_id'],
            name: 'idx_chat_messages_whatsapp_id'
        },
        {
            fields: ['created_at'],
            name: 'idx_chat_messages_created_at'
        }
    ]
});

// Métodos de instancia útiles
ChatMessage.prototype.isIncoming = function() {
    return this.direction === 'incoming';
};

ChatMessage.prototype.isOutgoing = function() {
    return this.direction === 'outgoing';
};

ChatMessage.prototype.isText = function() {
    return this.message_type === 'text';
};

ChatMessage.prototype.isMedia = function() {
    return ['image', 'audio', 'video', 'document'].includes(this.message_type);
};

ChatMessage.prototype.isRead = function() {
    return this.status === 'read';
};

ChatMessage.prototype.markAsRead = async function() {
    this.status = 'read';
    return await this.save();
};

ChatMessage.prototype.markAsDelivered = async function() {
    this.status = 'delivered';
    return await this.save();
};

ChatMessage.prototype.markAsFailed = async function() {
    this.status = 'failed';
    return await this.save();
};

ChatMessage.prototype.setRespondedBy = async function(advisorId, responderType = 'human') {
    this.responded_by = advisorId;
    this.responder_type = responderType;
    return await this.save();
};

// Métodos estáticos
ChatMessage.findBySession = async function(sessionId) {
    return await this.findAll({
        where: { chat_session_id: sessionId },
        order: [['created_at', 'ASC']]
    });
};

ChatMessage.findByContact = async function(contactId) {
    return await this.findAll({
        where: { contact_id: contactId },
        order: [['created_at', 'DESC']]
    });
};

ChatMessage.findUnreadByTenant = async function(tenantId) {
    return await this.findAll({
        where: {
            tenant_id: tenantId,
            status: 'sent'
        },
        order: [['created_at', 'ASC']]
    });
};

ChatMessage.createIncoming = async function(messageData) {
    return await this.create({
        ...messageData,
        direction: 'incoming',
        status: 'sent'
    });
};

ChatMessage.createOutgoing = async function(messageData) {
    return await this.create({
        ...messageData,
        direction: 'outgoing',
        status: 'sent'
    });
};

module.exports = ChatMessage;