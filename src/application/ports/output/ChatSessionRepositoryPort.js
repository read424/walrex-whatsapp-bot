/**
 * Puerto (interfaz) para el repositorio de sesiones de chat
 * Define el contrato que debe cumplir cualquier implementación de repositorio de sesiones
 */
class ChatSessionRepositoryPort {
    /**
     * Busca una sesión activa por contacto, conexión y tenant
     * @param {number} contactId - ID del contacto
     * @param {number} connectionId - ID de la conexión
     * @param {number} tenantId - ID del tenant
     * @returns {Promise<ChatSession|null>} - Entidad ChatSession o null si no existe
     */
    async findActiveSession(contactId, connectionId, tenantId) {
        throw new Error('Method not implemented');
    }

    /**
     * Crea una nueva sesión de chat
     * @param {Object} sessionData - Datos de la sesión
     * @returns {Promise<ChatSession>} - Entidad ChatSession creada
     */
    async create(sessionData) {
        throw new Error('Method not implemented');
    }

    /**
     * Busca una sesión por ID con relaciones opcionales
     * @param {number} sessionId - ID de la sesión
     * @param {Object} options - Opciones de inclusión (includeContact, includeMessages, etc.)
     * @returns {Promise<ChatSession|null>} - Entidad ChatSession o null si no existe
     */
    async findById(sessionId, options = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Actualiza una sesión existente
     * @param {number} sessionId - ID de la sesión
     * @param {Object} sessionData - Datos a actualizar
     * @returns {Promise<ChatSession>} - Entidad ChatSession actualizada
     */
    async update(sessionId, sessionData) {
        throw new Error('Method not implemented');
    }

    /**
     * Busca todas las sesiones de un tenant con filtros opcionales
     * @param {number} tenantId - ID del tenant
     * @param {Object} filters - Filtros (status, contactId, etc.)
     * @returns {Promise<ChatSession[]>} - Array de entidades ChatSession
     */
    async findByTenant(tenantId, filters = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Busca sesiones activas de un tenant
     * @param {number} tenantId - ID del tenant
     * @returns {Promise<ChatSession[]>} - Array de entidades ChatSession
     */
    async findActiveByTenant(tenantId) {
        throw new Error('Method not implemented');
    }

    /**
     * Busca sesiones por contacto
     * @param {number} contactId - ID del contacto
     * @returns {Promise<ChatSession[]>} - Array de entidades ChatSession
     */
    async findByContact(contactId) {
        throw new Error('Method not implemented');
    }
}

module.exports = ChatSessionRepositoryPort;