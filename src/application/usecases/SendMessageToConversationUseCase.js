const {
    InvalidMessageException,
    SessionNotFoundException,
    SessionClosedException,
    ConnectionUnavailableException
} = require('../../domain/exceptions/ChatExceptions');
const { IllegalArgumentException } = require('../../domain/exceptions');
const ChatMessage = require('../../domain/model/ChatMessage');

/**
 * Caso de uso: Enviar mensaje a una conversación
 *
 * Responsabilidad:
 * - Validar los parámetros del mensaje (conversationId, content, type, etc.)
 * - Obtener la conversación (chat session) y validar su estado
 * - Crear el mensaje en la base de datos
 * - Enviar el mensaje a través de WhatsApp
 * - Notificar via WebSocket sobre el nuevo mensaje
 * - Aplicar reglas de negocio relacionadas con el envío de mensajes
 *
 * Dependencias inyectadas:
 * - conversationRepository: Para obtener información de la conversación
 * - chatMessageRepository: Para persistir el mensaje
 * - chatSessionRepository: Para obtener y actualizar la sesión
 * - whatsAppConnectionPort: Para enviar mensajes por WhatsApp
 * - notificationPort: Para emitir eventos WebSocket
 * - logger: Para registrar operaciones y errores
 */
class SendMessageToConversationUseCase {
    constructor({
        conversationRepository,
        chatMessageRepository,
        chatSessionRepository,
        advisorRepository,
        whatsAppConnectionPort,
        notificationPort,
        logger
    }) {
        // Validar dependencias requeridas
        if (!conversationRepository) {
            throw new Error('conversationRepository is required');
        }
        if (!chatMessageRepository) {
            throw new Error('chatMessageRepository is required');
        }
        if (!chatSessionRepository) {
            throw new Error('chatSessionRepository is required');
        }
        if (!advisorRepository) {
            throw new Error('advisorRepository is required');
        }
        if (!whatsAppConnectionPort) {
            throw new Error('whatsAppConnectionPort is required');
        }
        if (!notificationPort) {
            throw new Error('notificationPort is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.conversationRepository = conversationRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.chatSessionRepository = chatSessionRepository;
        this.advisorRepository = advisorRepository;
        this.whatsAppConnectionPort = whatsAppConnectionPort;
        this.notificationPort = notificationPort;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso de envío de mensaje a conversación
     *
     * @param {Object} params - Parámetros del caso de uso
     * @param {string} params.conversationId - ID de la conversación
     * @param {string} params.content - Contenido del mensaje
     * @param {string} params.type - Tipo de mensaje (text, image, file, audio, video, location, contact)
     * @param {string} params.replyTo - ID del mensaje al que se responde (opcional)
     * @param {Object} params.metadata - Metadata adicional (opcional)
     * @param {number} params.userId - ID del usuario que envía el mensaje
     * @param {number} params.tenantId - ID del tenant
     * @returns {Promise<Object>} - Mensaje creado y enviado
     * @throws {IllegalArgumentException} - Si los parámetros son inválidos
     * @throws {InvalidMessageException} - Si el contenido es inválido
     * @throws {SessionNotFoundException} - Si la conversación no existe
     * @throws {SessionClosedException} - Si la conversación está cerrada
     * @throws {ConnectionUnavailableException} - Si la conexión no está disponible
     */
    async execute({ conversationId, content, type = 'text', replyTo, metadata, userId, tenantId }) {
        const startTime = Date.now();

        this.logger.info('SendMessageToConversationUseCase', 'Starting message send process', {
            conversationId,
            type,
            userId,
            tenantId,
            hasMetadata: !!metadata
        });

        try {
            // 1. Validar parámetros de entrada
            this.validateInputParameters({ conversationId, content, type, tenantId });

            // 2. Validar contenido del mensaje según su tipo
            this.validateMessageContent(content, type);

            // 3. Obtener la conversación y validar que existe
            const conversation = await this.getConversation(conversationId, tenantId);

            // 4. Validar que la conversación esté activa
            this.validateConversationStatus(conversation);

            // 5. Obtener la sesión de chat asociada
            const session = await this.getChatSession(conversationId);

            // 6. Buscar advisor si hay userId (para saber quién responde)
            const advisor = userId ? await this.getAdvisorByUserId(userId) : null;

            // 7. Preparar datos del mensaje para persistencia
            const messageData = this.prepareMessageData({
                session,
                content,
                type,
                advisor,
                tenantId,
                metadata,
                replyTo
            });

            // 8. Guardar mensaje en base de datos
            const savedMessage = await this.saveMessage(messageData);

            // 9. Enviar mensaje por WhatsApp
            await this.sendViaWhatsApp(session, savedMessage, conversation);

            // 10. Notificar via WebSocket sobre el nuevo mensaje
            await this.notifyNewMessage(tenantId, savedMessage, conversationId);

            // 11. Actualizar timestamp de la sesión
            await this.updateSessionTimestamp(conversationId);

            this.logger.info('SendMessageToConversationUseCase', 'Message sent successfully', {
                messageId: savedMessage.id,
                conversationId,
                duration: Date.now() - startTime
            });

            return {
                success: true,
                data: savedMessage.toJSON(),
                message: 'Mensaje enviado correctamente'
            };

        } catch (error) {
            this.logger.error('SendMessageToConversationUseCase', 'Error sending message', error, {
                conversationId,
                type,
                tenantId
            });
            throw error;
        }
    }

    /**
     * Valida los parámetros de entrada requeridos
     * @private
     */
    validateInputParameters({ conversationId, content, type, tenantId }) {
        if (!conversationId) {
            throw new IllegalArgumentException('conversationId is required');
        }

        if (!content) {
            throw new IllegalArgumentException('content is required');
        }

        if (!type) {
            throw new IllegalArgumentException('type is required');
        }

        if (!tenantId) {
            throw new IllegalArgumentException('tenantId is required');
        }

        // Validar tipos permitidos
        const allowedTypes = ['text', 'image', 'file', 'audio', 'video', 'location', 'contact'];
        if (!allowedTypes.includes(type)) {
            throw new IllegalArgumentException(
                `Invalid message type. Allowed types: ${allowedTypes.join(', ')}`
            );
        }
    }

    /**
     * Valida el contenido del mensaje según su tipo
     * @private
     */
    validateMessageContent(content, type) {
        if (!content || typeof content !== 'string') {
            throw new InvalidMessageException('Message content must be a non-empty string');
        }

        const trimmedContent = content.trim();
        if (trimmedContent.length === 0) {
            throw new InvalidMessageException('Message content cannot be empty');
        }

        // Validación de longitud para mensajes de texto
        if (type === 'text' && content.length > 4096) {
            throw new InvalidMessageException(
                'Text message content exceeds maximum length of 4096 characters'
            );
        }

        // Para otros tipos (image, file, etc.) el content debería ser una URL
        if (type !== 'text') {
            // Validación básica de URL para tipos multimedia
            const urlPattern = /^(https?:\/\/|data:)/i;
            if (!urlPattern.test(content)) {
                throw new InvalidMessageException(
                    `For type '${type}', content must be a valid URL or data URI`
                );
            }
        }
    }

    /**
     * Obtiene la conversación y valida que existe
     * @private
     */
    async getConversation(conversationId, tenantId) {
        const conversation = await this.conversationRepository.findById(conversationId, tenantId);

        if (!conversation) {
            this.logger.warn('SendMessageToConversationUseCase', 'Conversation not found', {
                conversationId,
                tenantId
            });
            throw new SessionNotFoundException(`Conversation ${conversationId} not found`);
        }

        return conversation;
    }

    /**
     * Valida que la conversación esté en estado activo
     * @private
     */
    validateConversationStatus(conversation) {
        if (conversation.status === 'closed' || conversation.status === 'archived') {
            this.logger.warn('SendMessageToConversationUseCase', 'Conversation is closed', {
                conversationId: conversation.id,
                status: conversation.status
            });
            throw new SessionClosedException(
                `Conversation ${conversation.id} is ${conversation.status} and cannot receive messages`
            );
        }
    }

    /**
     * Obtiene la sesión de chat
     * @private
     */
    async getChatSession(conversationId) {
        const session = await this.chatSessionRepository.findById(conversationId, {
            includeContact: true,
            includeConnection: true
        });

        if (!session) {
            throw new SessionNotFoundException(`Chat session ${conversationId} not found`);
        }

        return session;
    }

    /**
     * Obtiene el advisor asociado al userId
     * @private
     */
    async getAdvisorByUserId(userId) {
        try {
            const advisor = await this.advisorRepository.findByUserId(userId);

            if (!advisor) {
                this.logger.warn('SendMessageToConversationUseCase', 'No advisor found for user', {
                    userId
                });
            }

            return advisor;
        } catch (error) {
            this.logger.error('SendMessageToConversationUseCase', 'Error fetching advisor by userId', error, {
                userId
            });
            return null;
        }
    }

    /**
     * Prepara los datos del mensaje para persistencia
     * @private
     */
    prepareMessageData({ session, content, type, advisor, tenantId, metadata, replyTo }) {
        return {
            chatSessionId: session.id,
            contactId: session.contactId,
            content: content,
            messageType: type,
            direction: 'outgoing', // Los mensajes enviados desde la API son siempre salientes
            status: 'sent', // Estado inicial: enviado
            respondedBy: advisor ? advisor.id : null, // ID del advisor si existe, null para bot
            responderType: advisor ? 'human' : 'bot', // Tipo de respondedor: humano (agente) o bot
            tenantId: tenantId,
            mediaMetadata: metadata ? {
                ...metadata,
                replyTo: replyTo || null
            } : { replyTo: replyTo || null }
        };
    }

    /**
     * Guarda el mensaje en la base de datos
     * @private
     */
    async saveMessage(messageData) {
        try {
            const savedMessage = await this.chatMessageRepository.create(messageData);
            return savedMessage;
        } catch (error) {
            this.logger.error('SendMessageToConversationUseCase', 'Error saving message to database', error);
            throw new Error(`Failed to save message: ${error.message}`);
        }
    }

    /**
     * Envía el mensaje a través de WhatsApp
     * @private
     */
    async sendViaWhatsApp(session, message, conversation) {
        try {
            // Validar que existe una conexión
            if (!session.connectionId) {
                throw new ConnectionUnavailableException('No WhatsApp connection associated with this session');
            }

            // Obtener la conexión de WhatsApp
            const connection = await this.whatsAppConnectionPort.getConnectionById(session.connectionId);

            if (!connection) {
                throw new ConnectionUnavailableException(
                    `WhatsApp connection ${session.connectionId} not found`
                );
            }

            // Validar que la conexión esté disponible
            const isAvailable = await this.whatsAppConnectionPort.isConnectionAvailable(connection.clientId);

            if (!isAvailable) {
                throw new ConnectionUnavailableException(
                    `WhatsApp connection ${connection.clientId} is not available`
                );
            }

            // Preparar datos para envío
            const phoneNumber = `${conversation.contact.phoneNumber}@c.us`;
            const messagePayload = {
                phoneNumber,
                content: message.content,
                messageType: message.messageType
            };

            // Enviar mensaje
            await this.whatsAppConnectionPort.sendMessage(connection.clientId, messagePayload);

            this.logger.info('SendMessageToConversationUseCase', 'Message sent via WhatsApp', {
                messageId: message.id,
                phoneNumber: conversation.contact.phoneNumber
            });

        } catch (error) {
            this.logger.error('SendMessageToConversationUseCase', 'Error sending via WhatsApp', error);

            // Actualizar estado del mensaje a error
            await this.chatMessageRepository.update(message.id, { status: 'failed' });

            throw new ConnectionUnavailableException(
                `Failed to send message through WhatsApp: ${error.message}`
            );
        }
    }

    /**
     * Notifica via WebSocket sobre el nuevo mensaje
     * @private
     */
    async notifyNewMessage(tenantId, message, conversationId) {
        try {
            await this.notificationPort.notifyNewMessage(tenantId, {
                conversationId,
                message: message.toJSON(),
                timestamp: new Date().toISOString()
            });

            this.logger.debug('SendMessageToConversationUseCase', 'WebSocket notification sent', {
                tenantId,
                conversationId,
                messageId: message.id
            });
        } catch (error) {
            // No lanzar error, solo loguear - el mensaje ya fue enviado exitosamente
            this.logger.warn('SendMessageToConversationUseCase', 'Failed to send WebSocket notification', {
                error: error.message,
                tenantId,
                conversationId
            });
        }
    }

    /**
     * Actualiza el timestamp de la última actividad de la sesión
     * @private
     */
    async updateSessionTimestamp(conversationId) {
        try {
            // La actualización del updatedAt se maneja automáticamente por Sequelize
            // Pero podemos actualizar metadata si es necesario
            await this.chatSessionRepository.update(conversationId, {
                metadata: { lastActivity: new Date().toISOString() }
            });
        } catch (error) {
            // No es crítico si falla
            this.logger.warn('SendMessageToConversationUseCase', 'Failed to update session timestamp', {
                error: error.message,
                conversationId
            });
        }
    }
}

module.exports = SendMessageToConversationUseCase;