class Conversation {
    constructor({
        id,
        contactId,
        contact,
        channel,
        status,
        assignedAgentId = null,
        assignedAgent = null,
        department = 'general',
        lastMessage = null,
        unreadCount = 0,
        tags = [],
        priority = 'normal',
        notes = [],
        createdAt,
        updatedAt,
        closedAt = null,
        archivedAt = null,
        metadata = {}
    }) {
        this.id = id;
        this.contactId = contactId;
        this.contact = contact;
        this.channel = channel;
        this.status = status;
        this.assignedAgentId = assignedAgentId;
        this.assignedAgent = assignedAgent;
        this.department = department;
        this.lastMessage = lastMessage;
        this.unreadCount = unreadCount;
        this.tags = tags;
        this.priority = priority;
        this.notes = notes;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.closedAt = closedAt;
        this.archivedAt = archivedAt;
        this.metadata = metadata;
    }

    /**
     * Verifica si la conversación está activa
     */
    isActive() {
        return this.status === 'active';
    }

    /**
     * Verifica si la conversación tiene mensajes sin leer
     */
    hasUnreadMessages() {
        return this.unreadCount > 0;
    }

    /**
     * Verifica si la conversación está asignada a un agente
     */
    isAssigned() {
        return this.assignedAgentId !== null;
    }

    /**
     * Convierte la entidad a un objeto plano (para serialización)
     */
    toJSON() {
        return {
            id: this.id,
            contactId: this.contactId,
            contact: this.contact,
            channel: this.channel,
            status: this.status,
            assignedAgentId: this.assignedAgentId,
            assignedAgent: this.assignedAgent,
            department: this.department,
            lastMessage: this.lastMessage,
            unreadCount: this.unreadCount,
            tags: this.tags,
            priority: this.priority,
            notes: this.notes,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            closedAt: this.closedAt,
            archivedAt: this.archivedAt
        };
    }

    /**
     * Crea una instancia desde un objeto de base de datos
     */
    static fromDatabase(dbSession) {
        return new Conversation({
            id: dbSession.id.toString(),
            contactId: dbSession.contact_id.toString(),
            contact: dbSession.contact ? {
                id: dbSession.contact.id.toString(),
                phoneNumber: dbSession.contact.phone_number,
                name: dbSession.contact.name || dbSession.contact.phone_number,
                avatarUrl: dbSession.contact.avatar_url,
                email: dbSession.contact.metadata?.email,
                tags: dbSession.contact.metadata?.tags || []
            } : null,
            channel: dbSession.metadata?.channel || 'whatsapp',
            status: dbSession.status,
            assignedAgentId: dbSession.handled_by?.toString(),
            assignedAgent: dbSession.advisor ? {
                id: dbSession.advisor.id.toString(),
                name: dbSession.advisor.name,
                email: dbSession.advisor.email,
                role: dbSession.advisor.role
            } : null,
            department: dbSession.metadata?.department || 'general',
            lastMessage: dbSession.lastMessage ? {
                id: dbSession.lastMessage.id.toString(),
                content: dbSession.lastMessage.content,
                timestamp: dbSession.lastMessage.createdAt,
                direction: dbSession.lastMessage.direction,
                type: dbSession.lastMessage.message_type,
                status: dbSession.lastMessage.status
            } : null,
            unreadCount: dbSession.unreadCount || 0,
            tags: dbSession.metadata?.tags || [],
            priority: dbSession.metadata?.priority || 'normal',
            notes: dbSession.metadata?.notes || [],
            createdAt: dbSession.started_at || dbSession.createdAt,
            updatedAt: dbSession.updatedAt,
            closedAt: dbSession.ended_at,
            archivedAt: dbSession.metadata?.archivedAt,
            metadata: dbSession.metadata || {}
        });
    }
}

module.exports = Conversation;