const ChatMessageRepository  = require('../infrastructure/adapters/outbound/chatMessageRepository');
const structuredLogger = require('../infrastructure/config/StructuredLogger');

class AddChatMessageUseCase {
    constructor() {
        this.chatMessageRepository = new ChatMessageRepository();
    }

    /**
     * Agrega un mensaje ENTRANTE (del usuario)
     * @param {Object} messageData - Datos del mensaje
     * @param {string} messageData.phoneNumber - Número de teléfono
     * @param {string} messageData.content - Contenido del mensaje
     * @param {number} messageData.sessionId - ID de la sesión
     * @param {number} messageData.contactId - ID del contacto
     * @param {number} messageData.tenantId - ID del tenant
     * @param {string} messageData.messageType - Tipo de mensaje (default: 'text')
     * @param {string} messageData.whatsappMessageId - ID del mensaje de WhatsApp
     * @returns {Object} - Mensaje creado
     */
    async addIncomingMessage(messageData) {
        try {
            structuredLogger.info('AddChatMessageUseCase', 'Adding incoming message', {
                phoneNumber: messageData.phoneNumber,
                sessionId: messageData.sessionId,
                contactId: messageData.contactId,
                tenantId: messageData.tenantId
            });

            const chatMessage = await this.chatMessageRepository.addChatMessage({
                chat_session_id: messageData.sessionId,
                contact_id: messageData.contactId,
                message_type: messageData.messageType || 'text',
                content: messageData.content,
                direction: 'incoming',
                tenant_id: messageData.tenantId,
                whatsapp_message_id: messageData.whatsappMessageId || null,
                status: 'sent',
                responder_type: null,
                responded_by: null
            });

            structuredLogger.info('AddChatMessageUseCase', 'Incoming message added successfully', {
                messageId: chatMessage.id,
                sessionId: messageData.sessionId
            });

            return chatMessage;
        } catch (error) {
            structuredLogger.error('AddChatMessageUseCase', 'Error adding incoming message', error, {
                phoneNumber: messageData.phoneNumber,
                sessionId: messageData.sessionId
            });
            throw error;
        }
    }

    /**
     * Agrega un mensaje SALIENTE (del bot o asesor)
     * @param {Object} messageData - Datos del mensaje
     * @param {string} messageData.phoneNumber - Número de teléfono
     * @param {string} messageData.content - Contenido del mensaje
     * @param {number} messageData.sessionId - ID de la sesión
     * @param {number} messageData.contactId - ID del contacto
     * @param {number} messageData.tenantId - ID del tenant
     * @param {string} messageData.messageType - Tipo de mensaje (default: 'text')
     * @param {string} messageData.whatsappMessageId - ID del mensaje de WhatsApp
     * @param {string} messageData.responderType - 'bot' o 'human'
     * @param {number} messageData.respondedBy - ID del asesor (opcional)
     * @returns {Object} - Mensaje creado
     */
    async addOutgoingMessage(messageData) {
        try {
            structuredLogger.info('AddChatMessageUseCase', 'Adding outgoing message', messageData);

            const chatMessage = await this.chatMessageRepository.addChatMessage({
                status: 'sent',
                responded_by: messageData.respondedBy || null,
                responder_type: messageData.responderType || 'bot',
                chat_session_id: messageData.sessionId,
                contact_id: messageData.contactId,
                message_type: messageData.messageType || 'text',
                content: messageData.content,
                direction: 'outgoing',
                tenant_id: messageData.tenantId,
                whatsapp_message_id: messageData.whatsappMessageId || null,
            });

            structuredLogger.info('AddChatMessageUseCase', 'Outgoing message added successfully', {
                messageId: chatMessage.id,
                sessionId: messageData.sessionId,
                responderType: messageData.responderType
            });

            return chatMessage;
        } catch (error) {
            structuredLogger.error('AddChatMessageUseCase', 'Error adding outgoing message', error, {
                phoneNumber: messageData.phoneNumber,
                sessionId: messageData.sessionId
            });
            throw error;
        }
    }

    /**
     * Método legacy - mantener por compatibilidad
     * @deprecated Use addIncomingMessage instead
     */
    async addChatMessage(phoneNumber, messageBody, sessionId) {
        structuredLogger.warn('AddChatMessageUseCase', 'Using deprecated addChatMessage method', {
            phoneNumber,
            sessionId
        });

        // Este método necesita más información para funcionar correctamente
        // Por ahora, lanzará un error indicando que se debe usar el nuevo método
        throw new Error('Method deprecated. Use addIncomingMessage or addOutgoingMessage instead.');
    }
}

module.exports = AddChatMessageUseCase;