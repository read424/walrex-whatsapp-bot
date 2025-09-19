const { Model, DataTypes } = require('sequelize');  
const sequelize = require('../infrastructure/config/DatabaseConfig');
const ChatSession = require('./chatSession.model');

class ChatMessage extends Model {
    static associate(models){
        ChatMessage.belongsTo(models.ChatSession, {
            foreignKey: 'chat_session_id',
            targetKey: 'id'
        })
    }
}

ChatMessage.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    phone_number: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    received_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    status:{
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: -1
    },
    status_update_at:{
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'status_updated_at'
    },
    responded_by:{
        type: DataTypes.SMALLINT,
        allowNull: true,
        defaultValue: null
    },
    chat_session_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, { 
    sequelize, 
    modelName: 'ChatMessage', 
    tableName: 'chats_messages',
    timestamps: false
});

module.exports = ChatMessage;