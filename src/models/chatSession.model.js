const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');

class ChatSession extends Model {
    static associate(models) {
        // Una sesión pertenece a un contacto
        ChatSession.belongsTo(models.Contact, {
            foreignKey: 'contact_id',
            targetKey: 'id',
            as: 'contact'
        });

        // Una sesión pertenece a una conexión
        ChatSession.belongsTo(models.Connection, {
            foreignKey: 'connection_id',
            targetKey: 'id'
        });

        // Una sesión puede ser manejada por un asesor
        ChatSession.belongsTo(models.Advisor, {
            foreignKey: 'handled_by',
            targetKey: 'id',
            as: 'advisor'
        });

        // Una sesión tiene muchos mensajes
        ChatSession.hasMany(models.ChatMessage, {
            foreignKey: 'chat_session_id',
            sourceKey: 'id',
            as: 'messages'
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
    phone_number: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'Número de teléfono del contacto'
    },
    connection_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'connections',
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

/**
 * NOTA IMPORTANTE:
 * Este modelo ORM es SOLO para definición de schema y relaciones de base de datos.
 * NO debe contener lógica de negocio.
 *
 * Toda la lógica de negocio está en:
 * - Entidad de dominio: src/domain/model/ChatSession.js
 * - Los repositorios deben mapear entre este modelo ORM y la entidad de dominio
 *
 * Lógica de negocio previamente eliminada:
 * - isActive(), isClosed(), close(), assignToAdvisor(), getDuration() -> ahora en entidad de dominio
 * - findActiveByTenant(), findByContact(), createSession() -> ahora en repositorio
 */

module.exports = ChatSession;