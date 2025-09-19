const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');
const ChatMessage = require('./chatMessage.model');
const Advisor = require('./advisor.model');

class ChatSession extends Model {
    static associate(models){
        ChatSession.belongsTo(models.Advisor, {
            foreignKey: 'handle_by',
            targetKey: 'id'
        });

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
    },
    phone_number: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    started_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    ended_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    },
    handle_by:{
        type: DataTypes.INTEGER,
        allowNull: true,
    }
}, { 
    sequelize, 
    modelName: 'ChatSession', 
    tableName: 'chat_sessions',
    timestamps: false
});

module.exports = ChatSession;