/**
 * Entidad de dominio ChatSession (pura, sin dependencias de infraestructura)
 */
class ChatSession {
    constructor({
        id,
        contactId,
        contact = null,
        phoneNumber,
        connectionId,
        startedAt,
        endedAt = null,
        status,
        handledBy = null,
        advisor = null,
        tenantId,
        metadata = {},
        messages = [],
        createdAt,
        updatedAt
    }) {
        this.id = id;
        this.contactId = contactId;
        this.contact = contact;
        this.phoneNumber = phoneNumber;
        this.connectionId = connectionId;
        this.startedAt = startedAt;
        this.endedAt = endedAt;
        this.status = status;
        this.handledBy = handledBy;
        this.advisor = advisor;
        this.tenantId = tenantId;
        this.metadata = metadata;
        this.messages = messages;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    /**
     * Verifica si la sesión está activa
     */
    isActive() {
        return this.status === 'active';
    }

    /**
     * Verifica si la sesión está cerrada
     */
    isClosed() {
        return this.status === 'closed';
    }

    /**
     * Cierra la sesión
     */
    close() {
        this.status = 'closed';
        this.endedAt = new Date();
    }

    /**
     * Asigna la sesión a un asesor
     */
    assignToAdvisor(advisorId) {
        this.handledBy = advisorId;
    }

    /**
     * Obtiene la duración de la sesión
     */
    getDuration() {
        if (!this.endedAt) {
            return null;
        }
        return this.endedAt - this.startedAt;
    }

    /**
     * Convierte la entidad a un objeto plano
     */
    toJSON() {
        return {
            id: this.id,
            contactId: this.contactId,
            contact: this.contact,
            phoneNumber: this.phoneNumber,
            connectionId: this.connectionId,
            startedAt: this.startedAt,
            endedAt: this.endedAt,
            status: this.status,
            handledBy: this.handledBy,
            advisor: this.advisor,
            tenantId: this.tenantId,
            metadata: this.metadata,
            messages: this.messages,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Crea una instancia desde un objeto de base de datos
     */
    static fromDatabase(dbSession) {
        return new ChatSession({
            id: dbSession.id,
            contactId: dbSession.contact_id,
            contact: dbSession.contact ? require('./Contact').fromDatabase(dbSession.contact) : null,
            phoneNumber: dbSession.phone_number,
            connectionId: dbSession.connection_id,
            startedAt: dbSession.started_at,
            endedAt: dbSession.ended_at,
            status: dbSession.status,
            handledBy: dbSession.handled_by,
            advisor: dbSession.advisor,
            tenantId: dbSession.tenant_id,
            metadata: dbSession.metadata || {},
            messages: dbSession.messages || [],
            createdAt: dbSession.createdAt,
            updatedAt: dbSession.updatedAt
        });
    }

    /**
     * Convierte la entidad a formato de base de datos
     */
    toDatabase() {
        return {
            id: this.id,
            contact_id: this.contactId,
            phone_number: this.phoneNumber,
            connection_id: this.connectionId,
            started_at: this.startedAt,
            ended_at: this.endedAt,
            status: this.status,
            handled_by: this.handledBy,
            tenant_id: this.tenantId,
            metadata: this.metadata
        };
    }
}

module.exports = ChatSession;