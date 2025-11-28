/**
 * Puerto de salida (interfaz) para el repositorio de Advisor
 * Define el contrato que debe implementar cualquier adaptador de persistencia
 *
 * Responsabilidad:
 * - Definir operaciones de persistencia para Advisors
 * - Ser agnóstico de la tecnología de persistencia
 */
class AdvisorRepositoryPort {
    /**
     * Busca un advisor por su ID de usuario
     * @param {number} userId - ID del usuario asociado
     * @returns {Promise<Object|null>} Advisor encontrado o null
     */
    async findByUserId(userId) {
        throw new Error('Method findByUserId() must be implemented');
    }

    /**
     * Busca un advisor por su ID
     * @param {number} advisorId - ID del advisor
     * @returns {Promise<Object|null>} Advisor encontrado o null
     */
    async findById(advisorId) {
        throw new Error('Method findById() must be implemented');
    }

    /**
     * Busca advisors activos por tenant
     * @param {number} tenantId - ID del tenant
     * @returns {Promise<Array>} Lista de advisors activos
     */
    async findActiveByTenant(tenantId) {
        throw new Error('Method findActiveByTenant() must be implemented');
    }
}

module.exports = AdvisorRepositoryPort;
