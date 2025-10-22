const ChatMessageRepositoryPort = require('../../../../application/ports/output/ChatMessageRepositoryPort');
const ChatMessage = require('../../../../domain/model/ChatMessage');
const ChatMessageModel = require('../../../../models/chatMessage.model');
const ContactModel = require('../../../../models/Contact.model');
const ChatSessionModel = require('../../../../models/chatSession.model');

/**
 * Implementación del repositorio de mensajes de chat usando Sequelize
 * Esta clase pertenece a la capa de infraestructura y es la única que conoce Sequelize
 */
class ChatMessageRepositoryImpl extends ChatMessageRepositoryPort {
    async create(messageData) {
        const dbMessage = await ChatMessageModel.create({
            chat_session_id: messageData.chatSessionId,
            contact_id: messageData.contactId,
            content: messageData.content,
            message_type: messageData.messageType,
            direction: messageData.direction,
            status: messageData.status || 0,
            whatsapp_message_id: messageData.whatsappMessageId,
            media_url: messageData.mediaUrl,
            media_metadata: messageData.mediaMetadata,
            responded_by: messageData.respondedBy,
            responder_type: messageData.responderType,
            tenant_id: messageData.tenantId
        });

        // Recargar con relaciones
        const fullMessage = await ChatMessageModel.findByPk(dbMessage.id, {
            include: [
                { model: ContactModel, as: 'contact' },
                { model: ChatSessionModel, as: 'chatSession' }
            ]
        });

        return ChatMessage.fromDatabase(fullMessage.toJSON());
    }

    async findById(messageId, options = {}) {
        const includeArray = [];

        if (options.includeContact) {
            includeArray.push({ model: ContactModel, as: 'contact' });
        }

        if (options.includeSession) {
            includeArray.push({ model: ChatSessionModel, as: 'chatSession' });
        }

        const dbMessage = await ChatMessageModel.findByPk(messageId, {
            include: includeArray
        });

        if (!dbMessage) {
            return null;
        }

        return ChatMessage.fromDatabase(dbMessage.toJSON());
    }

    async findBySession(chatSessionId, limit = 50, offset = 0) {
        const dbMessages = await ChatMessageModel.findAll({
            where: { chat_session_id: chatSessionId },
            include: [
                { model: ContactModel, as: 'contact' }
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        return dbMessages.map(dbMessage => ChatMessage.fromDatabase(dbMessage.toJSON()));
    }

    async findByWhatsappMessageId(whatsappMessageId) {
        const dbMessage = await ChatMessageModel.findOne({
            where: { whatsapp_message_id: whatsappMessageId }
        });

        if (!dbMessage) {
            return null;
        }

        return ChatMessage.fromDatabase(dbMessage.toJSON());
    }

    async update(messageId, messageData) {
        const dbMessage = await ChatMessageModel.findByPk(messageId);

        if (!dbMessage) {
            throw new Error(`ChatMessage with id ${messageId} not found`);
        }

        if (messageData.status !== undefined) {
            dbMessage.status = messageData.status;
        }
        if (messageData.content !== undefined) {
            dbMessage.content = messageData.content;
        }

        await dbMessage.save();

        return ChatMessage.fromDatabase(dbMessage.toJSON());
    }

    async updateStatusByWhatsappId(whatsappMessageId, status) {
        const dbMessage = await ChatMessageModel.findOne({
            where: { whatsapp_message_id: whatsappMessageId }
        });

        if (!dbMessage) {
            return null;
        }

        dbMessage.status = status;
        await dbMessage.save();

        return ChatMessage.fromDatabase(dbMessage.toJSON());
    }

    async findBySessionWithCount(chatSessionId, page = 1, limit = 50) {
        // Calcular offset basado en la página
        const offset = (page - 1) * limit;

        // Obtener total de mensajes y mensajes paginados en paralelo
        const [total, dbMessages] = await Promise.all([
            ChatMessageModel.count({
                where: { chat_session_id: chatSessionId }
            }),
            ChatMessageModel.findAll({
                where: { chat_session_id: chatSessionId },
                include: [
                    { model: ContactModel, as: 'contact' }
                ],
                order: [['createdAt', 'DESC']],
                limit,
                offset
            })
        ]);

        // Mapear mensajes a entidades de dominio
        const messages = dbMessages.map(dbMessage => ChatMessage.fromDatabase(dbMessage.toJSON()));

        return {
            messages,
            total
        };
    }
}

module.exports = ChatMessageRepositoryImpl;