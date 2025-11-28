/**
 * Entidad de dominio ChatMessage (pura, sin dependencias de infraestructura)
 */
class ChatMessage {
    constructor({
        id,
        chatSessionId,
        contactId,
        contact = null,
        chatSession = null,
        content,
        messageType,
        direction,
        status = 0,
        whatsappMessageId = null,
        mediaUrl = null,
        mediaMetadata = null,
        respondedBy = null,
        responderType = null,
        tenantId,
        createdAt,
        updatedAt
    }) {
        this.id = id;
        this.chatSessionId = chatSessionId;
        this.contactId = contactId;
        this.contact = contact;
        this.chatSession = chatSession;
        this.content = content;
        this.messageType = messageType;
        this.direction = direction;
        this.status = status;
        this.whatsappMessageId = whatsappMessageId;
        this.mediaUrl = mediaUrl;
        this.mediaMetadata = mediaMetadata;
        this.respondedBy = respondedBy;
        this.responderType = responderType;
        this.tenantId = tenantId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    /**
     * Verifica si el mensaje es entrante
     */
    isIncoming() {
        return this.direction === 'incoming';
    }

    /**
     * Verifica si el mensaje es saliente
     */
    isOutgoing() {
        return this.direction === 'outgoing';
    }

    /**
     * Verifica si el mensaje tiene media
     */
    hasMedia() {
        return this.mediaUrl !== null;
    }

    /**
     * Actualiza el estado del mensaje
     */
    updateStatus(newStatus) {
        this.status = newStatus;
    }

    /**
     * Convierte la entidad a un objeto plano
     */
    toJSON() {
        return {
            id: this.id,
            chatSessionId: this.chatSessionId,
            contactId: this.contactId,
            contact: this.contact,
            chatSession: this.chatSession,
            content: this.content,
            messageType: this.messageType,
            direction: this.direction,
            status: this.status,
            whatsappMessageId: this.whatsappMessageId,
            mediaUrl: this.mediaUrl,
            mediaMetadata: this.mediaMetadata,
            respondedBy: this.respondedBy,
            responderType: this.responderType,
            tenantId: this.tenantId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Crea una instancia desde un objeto de base de datos
     */
    static fromDatabase(dbMessage) {
        return new ChatMessage({
            id: dbMessage.id,
            chatSessionId: dbMessage.chat_session_id,
            contactId: dbMessage.contact_id,
            contact: dbMessage.contact ? require('./Contact').fromDatabase(dbMessage.contact) : null,
            chatSession: dbMessage.chatSession,
            content: dbMessage.content,
            messageType: dbMessage.message_type,
            direction: dbMessage.direction,
            status: dbMessage.status,
            whatsappMessageId: dbMessage.whatsapp_message_id,
            mediaUrl: dbMessage.media_url,
            mediaMetadata: dbMessage.media_metadata,
            respondedBy: dbMessage.responded_by,
            responderType: dbMessage.responder_type,
            tenantId: dbMessage.tenant_id,
            createdAt: dbMessage.createdAt,
            updatedAt: dbMessage.updatedAt
        });
    }

    /**
     * Convierte la entidad a formato de base de datos
     */
    toDatabase() {
        return {
            id: this.id,
            chat_session_id: this.chatSessionId,
            contact_id: this.contactId,
            content: this.content,
            message_type: this.messageType,
            direction: this.direction,
            status: this.status,
            whatsapp_message_id: this.whatsappMessageId,
            media_url: this.mediaUrl,
            media_metadata: this.mediaMetadata,
            responded_by: this.respondedBy,
            responder_type: this.responderType,
            tenant_id: this.tenantId
        };
    }
}

module.exports = ChatMessage;