const { ChatSession, Contact, ChatMessage, Advisor } = require('../../../../models');
const { Op } = require('sequelize');
const Conversation = require('../../../../domain/model/Conversation');
const ConversationRepositoryPort = require('../../../../application/ports/output/ConversationRepositoryPort');
const structuredLogger = require('../../../../infrastructure/config/StructuredLogger');

class ConversationRepositoryImpl extends ConversationRepositoryPort {
    
    /**
     * Obtiene conversaciones activas con filtros
     */
    async findActiveConversations(tenantId, filters = {}) {
        try {
            structuredLogger.info('ConversationRepositoryImpl', 'Finding active conversations', {
                tenantId,
                filters
            });

            // Construir cláusula WHERE
            const where = {
                tenant_id: tenantId
            };

            // Aplicar filtros opcionales
            if (filters.status) {
                where.status = filters.status;
            } else {
                // Por defecto, solo activas y pendientes
                where.status = {
                    [Op.in]: ['active', 'pending']
                };
            }

            if (filters.assignedAgentId) {
                where.handled_by = filters.assignedAgentId;
            }

            // Filtros por metadata (JSONB)
            if (filters.priority) {
                where['metadata.priority'] = filters.priority;
            }

            if (filters.department) {
                where['metadata.department'] = filters.department;
            }

            if (filters.channel) {
                where['metadata.channel'] = filters.channel;
            }

            // Consultar base de datos
            const sessions = await ChatSession.findAll({
                where,
                include: [
                    {
                        model: Contact,
                        as: 'contact',
                        attributes: ['id', 'phone_number', 'name', 'avatar_url', 'metadata']
                    },
                    {
                        model: Advisor,
                        as: 'advisor',
                        attributes: ['id', 'name', 'email', 'role'],
                        required: false
                    }
                ],
                order: [['updatedAt', 'DESC']]
            });

            // Obtener último mensaje y conteo de no leídos para cada sesión
            const conversationsWithDetails = await Promise.all(
                sessions.map(async (session) => {
                    const lastMessage = await this.getLastMessage(session.id);
                    const unreadCount = await this.countUnreadMessages(session.id);
                    
                    // Agregar propiedades temporales
                    session.lastMessage = lastMessage;
                    session.unreadCount = unreadCount;

                    return Conversation.fromDatabase(session);
                })
            );

            structuredLogger.info('ConversationRepositoryImpl', 'Conversations found', {
                count: conversationsWithDetails.length,
                tenantId
            });

            return conversationsWithDetails;

        } catch (error) {
            structuredLogger.error('ConversationRepositoryImpl', 'Error finding conversations', error, {
                tenantId,
                filters
            });
            throw error;
        }
    }

    /**
     * Obtiene el último mensaje de una sesión
     */
    async getLastMessage(sessionId) {
        try {
            const message = await ChatMessage.findOne({
                where: { chat_session_id: sessionId },
                order: [['createdAt', 'DESC']],
                limit: 1
            });

            return message;
        } catch (error) {
            structuredLogger.error('ConversationRepositoryImpl', 'Error getting last message', error, {
                sessionId
            });
            return null;
        }
    }

    /**
     * Cuenta mensajes no leídos de una conversación
     * Un mensaje se considera "no leído" si:
     * - Es entrante (direction = 'incoming')
     * - Estado diferente de 'read'
     */
    async countUnreadMessages(sessionId) {
        try {
            const count = await ChatMessage.count({
                where: {
                    chat_session_id: sessionId,
                    direction: 'incoming',
                    status: {
                        [Op.ne]: 'read'
                    }
                }
            });

            return count;
        } catch (error) {
            structuredLogger.error('ConversationRepositoryImpl', 'Error counting unread messages', error, {
                sessionId
            });
            return 0;
        }
    }

    /**
     * Encuentra una conversación por ID
     */
    async findById(conversationId, tenantId) {
        try {
            const session = await ChatSession.findOne({
                where: {
                    id: conversationId,
                    tenant_id: tenantId
                },
                include: [
                    {
                        model: Contact,
                        as: 'contact'
                    },
                    {
                        model: Advisor,
                        as: 'advisor',
                        required: false
                    }
                ]
            });

            if (!session) {
                return null;
            }

            const lastMessage = await this.getLastMessage(session.id);
            const unreadCount = await this.countUnreadMessages(session.id);
            
            session.lastMessage = lastMessage;
            session.unreadCount = unreadCount;

            return Conversation.fromDatabase(session);

        } catch (error) {
            structuredLogger.error('ConversationRepositoryImpl', 'Error finding conversation by ID', error, {
                conversationId,
                tenantId
            });
            throw error;
        }
    }

    /**
     * Actualiza el estado de una conversación
     */
    async updateStatus(conversationId, status) {
        try {
            const [updatedRows] = await ChatSession.update(
                { status },
                { where: { id: conversationId } }
            );

            return updatedRows > 0;
        } catch (error) {
            structuredLogger.error('ConversationRepositoryImpl', 'Error updating status', error, {
                conversationId,
                status
            });
            throw error;
        }
    }

    /**
     * Asigna una conversación a un agente
     */
    async assignToAgent(conversationId, agentId) {
        try {
            const [updatedRows] = await ChatSession.update(
                { handled_by: agentId },
                { where: { id: conversationId } }
            );

            return updatedRows > 0;
        } catch (error) {
            structuredLogger.error('ConversationRepositoryImpl', 'Error assigning to agent', error, {
                conversationId,
                agentId
            });
            throw error;
        }
    }
}

module.exports = ConversationRepositoryImpl;