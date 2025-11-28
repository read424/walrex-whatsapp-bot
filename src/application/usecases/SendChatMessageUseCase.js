const {
    SessionNotFoundException,
    SessionClosedException,
    ConnectionUnavailableException,
    InvalidMessageException
} = require('../../domain/exceptions/ChatExceptions');

/**
 * Caso de uso: Enviar mensaje de chat
 *
 * Responsabilidad:
 * - Orquestar el proceso de envío de mensajes en sesiones de chat
 * - Validar que la sesión existe y está activa
 * - Verificar que la conexión de WhatsApp esté disponible
 * - Enviar el mensaje a través de la conexión
 * - Aplicar reglas de negocio relacionadas con el envío de mensajes
 *
 * Dependencias inyectadas:
 * - chatSessionRepository: Para obtener información de la sesión
 * - whatsAppConnectionPort: Para gestionar conexiones y enviar mensajes
 * - logger: Para registrar operaciones y errores
 */
class SendChatMessageUseCase {
    constructor(chatSessionRepository, whatsAppConnectionPort, logger) {
        if (!chatSessionRepository) {
            throw new Error('chatSessionRepository is required');
        }
        if (!whatsAppConnectionPort) {
            throw new Error('whatsAppConnectionPort is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.chatSessionRepository = chatSessionRepository;
        this.whatsAppConnectionPort = whatsAppConnectionPort;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso de envío de mensaje
     *
     * @param {Object} params - Parámetros del caso de uso
     * @param {number} params.sessionId - ID de la sesión de chat
     * @param {string} params.content - Contenido del mensaje
     * @param {string} params.messageType - Tipo de mensaje (text, image, etc.)
     * @param {number} params.advisorId - ID del asesor que envía el mensaje
     * @returns {Promise<Object>} - Mensaje enviado
     * @throws {InvalidMessageException} - Si el contenido es inválido
     * @throws {SessionNotFoundException} - Si la sesión no existe
     * @throws {SessionClosedException} - Si la sesión está cerrada
     * @throws {ConnectionUnavailableException} - Si la conexión no está disponible
     */
    async execute({ sessionId, content, messageType = 'text', advisorId }) {
        this.logger.info('SendChatMessageUseCase', 'Starting message send process', {
            sessionId,
            messageType,
            advisorId
        });

        // 1. Validaciones de negocio del mensaje
        this.validateMessageContent(content);

        // 2. Obtener sesión con sus relaciones (contacto)
        const session = await this.getSession(sessionId);

        // 3. Validar que la sesión esté en estado activo
        this.validateSessionStatus(session);

        // 4. Obtener y validar conexión de WhatsApp
        const connection = await this.getWhatsAppConnection(session.connectionId);

        // 5. Validar que la conexión esté disponible para enviar mensajes
        await this.validateConnectionAvailability(connection.clientId);

        // 6. Preparar datos del mensaje en formato WhatsApp
        const messageData = this.prepareMessageData(session, content, messageType, advisorId);

        // 7. Enviar mensaje a través de la estrategia de conexión
        const sentMessage = await this.sendMessage(connection.clientId, messageData);

        this.logger.info('SendChatMessageUseCase', 'Message sent successfully', {
            sessionId,
            messageId: sentMessage.id
        });

        return sentMessage;
    }

    /**
     * Valida que el contenido del mensaje sea válido
     * @private
     */
    validateMessageContent(content) {
        if (!content || typeof content !== 'string') {
            throw new InvalidMessageException('Message content is required and must be a string');
        }

        if (content.trim().length === 0) {
            throw new InvalidMessageException('Message content cannot be empty');
        }

        // Validación de longitud máxima (ejemplo: 4096 caracteres para WhatsApp)
        if (content.length > 4096) {
            throw new InvalidMessageException('Message content exceeds maximum length of 4096 characters');
        }
    }

    /**
     * Obtiene la sesión de chat con sus relaciones
     * @private
     */
    async getSession(sessionId) {
        const session = await this.chatSessionRepository.findById(sessionId, {
            includeContact: true
        });

        if (!session) {
            this.logger.warn('SendChatMessageUseCase', 'Session not found', { sessionId });
            throw new SessionNotFoundException(`Session ${sessionId} not found`);
        }

        return session;
    }

    /**
     * Valida que la sesión esté en estado activo
     * @private
     */
    validateSessionStatus(session) {
        // Verificar que la sesión no esté cerrada
        if (session.status === 'closed' || session.status === 'archived') {
            this.logger.warn('SendChatMessageUseCase', 'Session is closed', {
                sessionId: session.id,
                status: session.status
            });
            throw new SessionClosedException(
                `Session ${session.id} is ${session.status} and cannot receive messages`
            );
        }
    }

    /**
     * Obtiene la conexión de WhatsApp desde la base de datos
     * @private
     */
    async getWhatsAppConnection(connectionId) {
        const connection = await this.whatsAppConnectionPort.getConnectionById(connectionId);

        if (!connection) {
            this.logger.error('SendChatMessageUseCase', 'WhatsApp connection not found', {
                connectionId
            });
            throw new ConnectionUnavailableException(
                `WhatsApp connection ${connectionId} not found`
            );
        }

        return connection;
    }

    /**
     * Valida que la conexión activa esté disponible
     * @private
     */
    async validateConnectionAvailability(clientId) {
        const isAvailable = await this.whatsAppConnectionPort.isConnectionAvailable(clientId);

        if (!isAvailable) {
            this.logger.error('SendChatMessageUseCase', 'WhatsApp connection not available', {
                clientId
            });
            throw new ConnectionUnavailableException(
                `WhatsApp connection ${clientId} is not available or not connected`
            );
        }
    }

    /**
     * Prepara los datos del mensaje en formato requerido por WhatsApp
     * @private
     */
    prepareMessageData(session, content, messageType, advisorId) {
        // Construir número de teléfono en formato WhatsApp
        const phoneNumber = `${session.contact.phoneNumber}@c.us`;

        return {
            phoneNumber,
            content,
            messageType,
            advisorId
        };
    }

    /**
     * Envía el mensaje a través del puerto de conexión
     * @private
     */
    async sendMessage(clientId, messageData) {
        try {
            return await this.whatsAppConnectionPort.sendMessage(clientId, messageData);
        } catch (error) {
            this.logger.error('SendChatMessageUseCase', 'Error sending message', error, {
                clientId,
                messageData
            });
            throw new ConnectionUnavailableException(
                `Failed to send message through WhatsApp: ${error.message}`
            );
        }
    }
}

module.exports = SendChatMessageUseCase;