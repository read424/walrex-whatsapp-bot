/**
 * Puerto (interfaz) para el repositorio de contactos
 * Define el contrato que debe cumplir cualquier implementación de repositorio de contactos
 */
class ContactRepositoryPort {
    /**
     * Busca un contacto por número de teléfono y tenant
     * @param {string} phoneNumber - Número de teléfono del contacto
     * @param {number} tenantId - ID del tenant
     * @returns {Promise<Contact|null>} - Entidad Contact o null si no existe
     */
    async findByPhoneNumber(phoneNumber, tenantId) {
        throw new Error('Method not implemented');
    }

    /**
     * Crea un nuevo contacto
     * @param {Object} contactData - Datos del contacto
     * @returns {Promise<Contact>} - Entidad Contact creada
     */
    async create(contactData) {
        throw new Error('Method not implemented');
    }

    /**
     * Actualiza un contacto existente
     * @param {number} contactId - ID del contacto
     * @param {Object} contactData - Datos a actualizar
     * @returns {Promise<Contact>} - Entidad Contact actualizada
     */
    async update(contactId, contactData) {
        throw new Error('Method not implemented');
    }

    /**
     * Busca un contacto por ID
     * @param {number} contactId - ID del contacto
     * @returns {Promise<Contact|null>} - Entidad Contact o null si no existe
     */
    async findById(contactId) {
        throw new Error('Method not implemented');
    }

    /**
     * Busca todos los contactos de un tenant
     * @param {number} tenantId - ID del tenant
     * @param {Object} options - Opciones adicionales (limit, offset, etc.)
     * @returns {Promise<Contact[]>} - Array de entidades Contact
     */
    async findByTenant(tenantId, options = {}) {
        throw new Error('Method not implemented');
    }
}

module.exports = ContactRepositoryPort;