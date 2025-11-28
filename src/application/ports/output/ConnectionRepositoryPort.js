/**
 * Puerto de salida para repositorio de Connections
 * Define el contrato que debe implementar cualquier adaptador de persistencia
 * NO contiene implementación, solo la interfaz
 */
class ConnectionRepositoryPort {
    /**
     * Busca una conexión por ID
     * @param {number} connectionId - ID de la conexión
     * @returns {Promise<Connection|null>} - Entidad de dominio Connection o null si no existe
     */
    async findById(connectionId) {
        throw new Error('Method findById() must be implemented');
    }

    /**
     * Busca todas las conexiones de un tenant
     * @param {string|number} tenantId - ID del tenant
     * @param {Object} filters - Filtros opcionales (status, providerType)
     * @returns {Promise<Connection[]>} - Array de entidades de dominio Connection
     */
    async findByTenant(tenantId, filters = {}) {
        throw new Error('Method findByTenant() must be implemented');
    }

    /**
     * Busca una conexión por nombre dentro de un tenant
     * @param {string} connectionName - Nombre de la conexión
     * @param {string|number} tenantId - ID del tenant
     * @returns {Promise<Connection|null>} - Entidad de dominio Connection o null si no existe
     */
    async findByName(connectionName, tenantId) {
        throw new Error('Method findByName() must be implemented');
    }

    /**
     * Crea una nueva conexión
     * @param {Connection} connection - Entidad de dominio Connection
     * @returns {Promise<Connection>} - Entidad de dominio Connection con ID asignado
     */
    async create(connection) {
        throw new Error('Method create() must be implemented');
    }

    /**
     * Actualiza una conexión existente
     * @param {Connection} connection - Entidad de dominio Connection con cambios
     * @returns {Promise<Connection>} - Entidad de dominio Connection actualizada
     */
    async update(connection) {
        throw new Error('Method update() must be implemented');
    }

    /**
     * Elimina una conexión por ID
     * @param {number} connectionId - ID de la conexión
     * @returns {Promise<boolean>} - true si se eliminó, false si no existía
     */
    async delete(connectionId) {
        throw new Error('Method delete() must be implemented');
    }

    /**
     * Actualiza el estado de una conexión
     * @param {number} connectionId - ID de la conexión
     * @param {string} newStatus - Nuevo estado
     * @returns {Promise<Connection>} - Entidad de dominio Connection actualizada
     */
    async updateStatus(connectionId, newStatus) {
        throw new Error('Method updateStatus() must be implemented');
    }

    /**
     * Actualiza el QR code de una conexión
     * @param {number} connectionId - ID de la conexión
     * @param {string} qrCode - Código QR en base64
     * @returns {Promise<Connection>} - Entidad de dominio Connection actualizada
     */
    async updateQRCode(connectionId, qrCode) {
        throw new Error('Method updateQRCode() must be implemented');
    }
}

module.exports = ConnectionRepositoryPort;