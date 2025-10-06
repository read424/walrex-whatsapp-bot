const { ChatMessage } = require('../../../models');
const { RESPONDER_TYPES } = require('../../../domain/constants/WhatsAppConstants');
const structuredLogger = require('../../config/StructuredLogger');

class ChatMessageRepository {

    /**
     * Método genérico para agregar mensajes
     * Acepta un objeto con todos los campos necesarios del modelo ChatMessage
     * @param {Object} messageData - Datos completos del mensaje
     * @returns {Object} - Mensaje creado
     */
    async addChatMessage(messageData) {
        try {
            structuredLogger.info('ChatMessageRepository', 'Creating chat message', messageData);

            // Crear el mensaje con TODOS los campos necesarios
            const chatMessage = await ChatMessage.create({
                status: messageData.status || 'sent',
                responded_by: messageData.responded_by || null,
                responder_type: messageData.responder_type || null,
                chat_session_id: messageData.chat_session_id,
                contact_id: messageData.contact_id,
                message_type: messageData.message_type || 'text',
                content: messageData.content,
                media_url: messageData.media_url || null,
                media_metadata: messageData.media_metadata || null,
                direction: messageData.direction,
                whatsapp_message_id: messageData.whatsapp_message_id || null,
                tenant_id: messageData.tenant_id
            });

            structuredLogger.info('ChatMessageRepository', 'Chat message created successfully', {
                messageId: chatMessage.id,
                direction: chatMessage.direction
            });

            return chatMessage;
        } catch (error) {
            structuredLogger.error('ChatMessageRepository', 'Error creating chat message', error, {
                messageData
            });
            throw error;
        }
    }

    /**
     * Método legacy - mantener por compatibilidad con código antiguo
     * @deprecated - Usar addChatMessage con objeto completo
     */
    async addChatMessageResponse(phoneNumber, message, chatSessionId, response_by) {
        structuredLogger.warn('ChatMessageRepository', 'Using deprecated addChatMessageResponse', {
            phoneNumber,
            chatSessionId
        });

        // Este método no tiene suficiente información
        // Lanzar error para forzar el uso del método correcto
        throw new Error('Method deprecated. Use addChatMessage with complete messageData object.');
    }

}

module.exports = ChatMessageRepository;