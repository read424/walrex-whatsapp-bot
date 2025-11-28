/**
 * Entidad de dominio Contact (pura, sin dependencias de infraestructura)
 */
class Contact {
    constructor({
        id,
        phoneNumber,
        name,
        avatarUrl = null,
        metadata = {},
        tenantId,
        createdAt,
        updatedAt
    }) {
        this.id = id;
        this.phoneNumber = phoneNumber;
        this.name = name;
        this.avatarUrl = avatarUrl;
        this.metadata = metadata;
        this.tenantId = tenantId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    /**
     * Obtiene el nombre completo o el número de teléfono si no hay nombre
     */
    getFullName() {
        return this.name || this.phoneNumber;
    }

    /**
     * Verifica si el contacto está activo
     */
    isActive() {
        return this.metadata?.status !== 'blocked';
    }

    /**
     * Agrega un tag al contacto
     */
    addTag(tag) {
        if (!this.metadata.tags) {
            this.metadata.tags = [];
        }
        if (!this.metadata.tags.includes(tag)) {
            this.metadata.tags.push(tag);
        }
    }

    /**
     * Remueve un tag del contacto
     */
    removeTag(tag) {
        if (this.metadata?.tags) {
            this.metadata.tags = this.metadata.tags.filter(t => t !== tag);
        }
    }

    /**
     * Convierte la entidad a un objeto plano
     */
    toJSON() {
        return {
            id: this.id,
            phoneNumber: this.phoneNumber,
            name: this.name,
            avatarUrl: this.avatarUrl,
            metadata: this.metadata,
            tenantId: this.tenantId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Crea una instancia desde un objeto de base de datos
     */
    static fromDatabase(dbContact) {
        return new Contact({
            id: dbContact.id,
            phoneNumber: dbContact.phone_number,
            name: dbContact.name,
            avatarUrl: dbContact.avatar_url,
            metadata: dbContact.metadata || {},
            tenantId: dbContact.tenant_id,
            createdAt: dbContact.created_at || dbContact.createdAt,
            updatedAt: dbContact.updated_at || dbContact.updatedAt
        });
    }

    /**
     * Convierte la entidad a formato de base de datos
     */
    toDatabase() {
        return {
            id: this.id,
            phone_number: this.phoneNumber,
            name: this.name,
            avatar_url: this.avatarUrl,
            metadata: this.metadata,
            tenant_id: this.tenantId
        };
    }
}

module.exports = Contact;