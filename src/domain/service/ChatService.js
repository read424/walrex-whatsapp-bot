/**
 * Servicio de dominio para gestión de chats
 * Este servicio SOLO depende de puertos (interfaces), nunca de implementaciones concretas
 * Cumple con los principios de Arquitectura Hexagonal
 *
 * IMPORTANTE: Este servicio NO importa nada de infraestructura
 * Todas las dependencias se inyectan a través del constructor
 */
class ChatService {
    /**
     * @param {Object} dependencies - Dependencias inyectadas
     * @param {ContactRepositoryPort} dependencies.contactRepository - Repositorio de contactos
     * @param {ChatSessionRepositoryPort} dependencies.chatSessionRepository - Repositorio de sesiones
     * @param {ChatMessageRepositoryPort} dependencies.chatMessageRepository - Repositorio de mensajes
     * @param {LoggerPort} dependencies.logger - Servicio de logging
     * @param {NotificationPort} dependencies.notificationService - Servicio de notificaciones
     */
    constructor({ contactRepository, chatSessionRepository, chatMessageRepository, logger, notificationService }) {
        this.contactRepository = contactRepository;
        this.chatSessionRepository = chatSessionRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.logger = logger;
        this.notificationService = notificationService;
    }

    async processIncomingMessage(whatsappMessage, connectionId, tenantId) {
        try {
            this.logger.info('ChatService', 'Process Message Incoming', { whatsappMessage, connectionId, tenantId });

            const contact = await this.findOrCreateContact(
                whatsappMessage.from.replace('@c.us', ''),
                whatsappMessage._data.notifyName || whatsappMessage.from.replace('@c.us', ''),
                tenantId
            );

            const chatSession = await this.findOrCreateChatSession(
                contact.id,
                connectionId,
                tenantId,
                whatsappMessage.from.replace('@c.us', '')
            );

            const message = await this.createChatMessage({
                chatSessionId: chatSession.id,
                contactId: contact.id,
                content: whatsappMessage.body,
                messageType: this.getMessageType(whatsappMessage),
                direction: 'incoming',
                whatsappMessageId: whatsappMessage.id._serialized,
                mediaUrl: await this.extractMediaUrl(whatsappMessage),
                mediaMetadata: await this.extractMediaMetadata(whatsappMessage),
                tenantId: parseInt(tenantId)
            });

            await this.notificationService.emitToTenant(tenantId, 'newMessage', {
                message: message.toJSON(),
                chatSession: chatSession.toJSON(),
                contact: contact.toJSON()
            });

            this.logger.info('ChatService', 'Message processed successfully', {
                messageId: message.id,
                contactPhone: contact.phoneNumber,
                sessionId: chatSession.id
            });

            return { message, chatSession, contact };

        } catch (error) {
            this.logger.error('ChatService', 'Error processing incoming message', error);
            throw error;
        }
    }

    async findOrCreateContact(phoneNumber, name, tenantId) {
        try {
            this.logger.info('ChatService', 'Finding or creating contact', {
                phoneNumber,
                name,
                tenantId
            });

            let contact = await this.contactRepository.findByPhoneNumber(phoneNumber, parseInt(tenantId));

            if (!contact) {
                contact = await this.contactRepository.create({
                    phoneNumber,
                    name,
                    tenantId: parseInt(tenantId),
                    metadata: {
                        source: 'whatsapp',
                        createdFrom: 'incoming_message'
                    }
                });
                this.logger.info('ChatService', 'New contact created', contact.toJSON());
            } else if (contact.name !== name && name) {
                contact = await this.contactRepository.update(contact.id, { name });
                this.logger.info('ChatService', 'Contact name updated', contact.toJSON());
            }

            return contact;

        } catch (error) {
            this.logger.error('ChatService', 'Error finding or creating contact', error);
            throw error;
        }
    }

    async findOrCreateChatSession(contactId, connectionId, tenantId, phoneNumber) {
        try {
            this.logger.info('ChatService', 'Find or create chat session', {
                contactId,
                connectionId,
                tenantId,
                phoneNumber
            });

            let chatSession = await this.chatSessionRepository.findActiveSession(
                parseInt(contactId),
                connectionId,
                tenantId
            );

            if (!chatSession) {
                chatSession = await this.chatSessionRepository.create({
                    contactId,
                    phoneNumber,
                    connectionId,
                    status: 'active',
                    tenantId,
                    startedAt: new Date(),
                    metadata: {
                        source: 'whatsapp',
                        autoCreated: true
                    }
                });

                this.logger.info('ChatService', 'New chat session created', {
                    sessionId: chatSession.id,
                    contactId,
                    connectionId
                });
            }

            return chatSession;

        } catch (error) {
            this.logger.error('ChatService', 'Error finding or creating chat session', error);
            throw error;
        }
    }

    async createChatMessage(messageData) {
        try {
            const message = await this.chatMessageRepository.create(messageData);
            return message;
        } catch (error) {
            this.logger.error('ChatService', 'Error creating chat message', error);
            throw error;
        }
    }

    async sendOutgoingMessage(chatSessionId, content, advisorId, messageType = 'text') {
        try {
            const chatSession = await this.chatSessionRepository.findById(chatSessionId, {
                includeContact: true
            });

            if (!chatSession) {
                throw new Error('Chat session not found');
            }

            const message = await this.createChatMessage({
                chatSessionId,
                contactId: chatSession.contactId,
                content,
                messageType,
                direction: 'outgoing',
                status: 0,
                respondedBy: advisorId,
                responderType: 'human',
                tenantId: chatSession.tenantId
            });

            this.notificationService.emitToTenant(chatSession.tenantId, 'messageSent', {
                message: message.toJSON(),
                chatSession: chatSession.toJSON(),
                contact: chatSession.contact ? chatSession.contact.toJSON() : null
            });

            return message;

        } catch (error) {
            this.logger.error('ChatService', 'Error sending outgoing message', error);
            throw error;
        }
    }

    async getChatSessions(tenantId, filters = {}) {
        try {
            const sessions = await this.chatSessionRepository.findByTenant(tenantId, filters);
            return sessions;
        } catch (error) {
            this.logger.error('ChatService', 'Error getting chat sessions', error);
            throw error;
        }
    }

    async getChatMessages(chatSessionId, limit = 50, offset = 0) {
        try {
            const messages = await this.chatMessageRepository.findBySession(chatSessionId, limit, offset);
            return messages;
        } catch (error) {
            this.logger.error('ChatService', 'Error getting chat messages', error);
            throw error;
        }
    }

    getMessageType(whatsappMessage) {
        const type = whatsappMessage.type;
        switch (type) {
            case 'image': return 'image';
            case 'audio':
            case 'ptt': return 'audio';
            case 'video': return 'video';
            case 'document': return 'document';
            case 'location': return 'location';
            case 'vcard': return 'contact';
            default: return 'text';
        }
    }

    async extractMediaUrl(whatsappMessage) {
        if (whatsappMessage.hasMedia) {
            try {
                const media = await whatsappMessage.downloadMedia();
                return `data:${media.mimeType};base64,${media.data}`;
            } catch (error) {
                this.logger.error('ChatService', 'Error extracting media', error);
                return null;
            }
        }
        return null;
    }

    async extractMediaMetadata(whatsappMessage) {
        if (whatsappMessage.hasMedia) {
            try {
                const media = await whatsappMessage.downloadMedia();
                return {
                    mimeType: media.mimeType,
                    fileName: media.filename,
                    fileSize: media.data?.length || 0
                };
            } catch (error) {
                this.logger.error('ChatService', 'Error extracting media metadata', error);
                return null;
            }
        }

        return null;
    }

    async updateChatSessionStatus(whatsappMessageId, status) {
        try {
            // Validar que whatsappMessageId no sea undefined o null
            if (!whatsappMessageId) {
                this.logger.warn('ChatService', 'updateChatSessionStatus called with invalid whatsappMessageId', {
                    whatsappMessageId,
                    status
                });
                return;
            }

            const message = await this.chatMessageRepository.updateStatusByWhatsappId(whatsappMessageId, status);

            if (message) {
                this.notificationService.emitToTenant(message.tenantId, 'messageStatusUpdated', {
                    messageId: message.id,
                    whatsappMessageId,
                    status
                });
            } else {
                this.logger.warn('ChatService', 'Message not found for whatsappMessageId', {
                    whatsappMessageId,
                    status
                });
            }
        } catch (error) {
            this.logger.error('ChatService', 'Error updating chat session status', error);
            throw error;
        }
    }

    async getConversations(tenantId, filters = {}) {
        try {
            const sessions = await this.chatSessionRepository.findByTenant(tenantId, filters);

            // Transformar a conversaciones si es necesario
            // Este método podría usar el modelo Conversation.fromDatabase
            return sessions.map(session => this.transformToConversation(session));
        } catch (error) {
            this.logger.error('ChatService', 'Error getting conversations', error);
            throw error;
        }
    }

    transformToConversation(session) {
        const Conversation = require('../model/Conversation');

        // Transformar ChatSession a Conversation
        return new Conversation({
            id: session.id.toString(),
            contactId: session.contactId.toString(),
            contact: session.contact ? {
                id: session.contact.id.toString(),
                phoneNumber: session.contact.phoneNumber,
                name: session.contact.name || session.contact.phoneNumber,
                avatarUrl: session.contact.avatarUrl,
                email: session.contact.metadata?.email,
                tags: session.contact.metadata?.tags || []
            } : null,
            channel: session.metadata?.channel || 'whatsapp',
            status: session.status,
            assignedAgentId: session.handledBy?.toString(),
            assignedAgent: session.advisor,
            department: session.metadata?.department || 'general',
            lastMessage: session.messages && session.messages.length > 0 ? {
                id: session.messages[0].id.toString(),
                content: session.messages[0].content,
                timestamp: session.messages[0].createdAt,
                direction: session.messages[0].direction,
                type: session.messages[0].messageType,
                status: session.messages[0].status
            } : null,
            unreadCount: 0,
            tags: session.metadata?.tags || [],
            priority: session.metadata?.priority || 'normal',
            notes: session.metadata?.notes || [],
            createdAt: session.startedAt || session.createdAt,
            updatedAt: session.updatedAt,
            closedAt: session.endedAt,
            archivedAt: session.metadata?.archivedAt,
            metadata: session.metadata || {}
        });
    }
}

module.exports = ChatService;