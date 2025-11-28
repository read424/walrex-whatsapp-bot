const ChatSessionRepositoryPort = require('../../../../application/ports/output/ChatSessionRepositoryPort');
const ChatSession = require('../../../../domain/model/ChatSession');
const ChatSessionModel = require('./entity/chatSession.model');
const ContactModel = require('./entity/Contact.model');
const ChatMessageModel = require('./entity/chatMessage.model');

/**
 * Implementación del repositorio de sesiones de chat usando Sequelize
 * Esta clase pertenece a la capa de infraestructura y es la única que conoce Sequelize
 */
class ChatSessionRepositoryImpl extends ChatSessionRepositoryPort {
    async findActiveSession(contactId, connectionId, tenantId) {
        const dbSession = await ChatSessionModel.findOne({
            where: {
                contact_id: contactId,
                connection_id: connectionId,
                status: 'active',
                tenant_id: tenantId
            },
            include: [
                { model: ContactModel, as: 'contact' }
            ]
        });

        if (!dbSession) {
            return null;
        }

        return ChatSession.fromDatabase(dbSession.toJSON());
    }

    async create(sessionData) {
        const dbSession = await ChatSessionModel.create({
            contact_id: sessionData.contactId,
            phone_number: sessionData.phoneNumber,
            connection_id: sessionData.connectionId,
            status: sessionData.status || 'active',
            tenant_id: sessionData.tenantId,
            started_at: sessionData.startedAt || new Date(),
            metadata: sessionData.metadata || {
                source: 'whatsapp',
                autoCreated: true
            }
        });

        // Recargar con relaciones
        const fullSession = await ChatSessionModel.findByPk(dbSession.id, {
            include: [{ model: ContactModel, as: 'contact' }]
        });

        return ChatSession.fromDatabase(fullSession.toJSON());
    }

    async findById(sessionId, options = {}) {
        const includeArray = [];

        if (options.includeContact) {
            includeArray.push({ model: ContactModel, as: 'contact' });
        }

        if (options.includeMessages) {
            includeArray.push({
                model: ChatMessageModel,
                as: 'messages',
                limit: options.messagesLimit || 1,
                order: [['created_at', 'DESC']]
            });
        }

        const dbSession = await ChatSessionModel.findByPk(sessionId, {
            include: includeArray
        });

        if (!dbSession) {
            return null;
        }

        return ChatSession.fromDatabase(dbSession.toJSON());
    }

    async update(sessionId, sessionData) {
        const dbSession = await ChatSessionModel.findByPk(sessionId);

        if (!dbSession) {
            throw new Error(`ChatSession with id ${sessionId} not found`);
        }

        if (sessionData.status !== undefined) {
            dbSession.status = sessionData.status;
        }
        if (sessionData.endedAt !== undefined) {
            dbSession.ended_at = sessionData.endedAt;
        }
        if (sessionData.handledBy !== undefined) {
            dbSession.handled_by = sessionData.handledBy;
        }
        if (sessionData.metadata !== undefined) {
            dbSession.metadata = sessionData.metadata;
        }

        await dbSession.save();

        return ChatSession.fromDatabase(dbSession.toJSON());
    }

    async findByTenant(tenantId, filters = {}) {
        const where = { tenant_id: tenantId };

        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.contactId) {
            where.contact_id = filters.contactId;
        }

        const dbSessions = await ChatSessionModel.findAll({
            where,
            include: [
                { model: ContactModel, as: 'contact' },
                {
                    model: ChatMessageModel,
                    as: 'messages',
                    limit: 1,
                    order: [['created_at', 'DESC']]
                }
            ],
            order: [['updated_at', 'DESC']]
        });

        return dbSessions.map(dbSession => ChatSession.fromDatabase(dbSession.toJSON()));
    }

    async findActiveByTenant(tenantId) {
        const dbSessions = await ChatSessionModel.findAll({
            where: {
                tenant_id: tenantId,
                status: 'active'
            },
            order: [['started_at', 'DESC']]
        });

        return dbSessions.map(dbSession => ChatSession.fromDatabase(dbSession.toJSON()));
    }

    async findByContact(contactId) {
        const dbSessions = await ChatSessionModel.findAll({
            where: { contact_id: contactId },
            order: [['started_at', 'DESC']]
        });

        return dbSessions.map(dbSession => ChatSession.fromDatabase(dbSession.toJSON()));
    }
}

module.exports = ChatSessionRepositoryImpl;