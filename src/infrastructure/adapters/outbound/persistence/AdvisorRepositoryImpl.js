const AdvisorRepositoryPort = require('../../../../application/ports/output/AdvisorRepositoryPort');
const AdvisorModel = require('../../../../models/advisor.model');

/**
 * Implementación del repositorio de Advisor usando Sequelize
 * Esta clase pertenece a la capa de infraestructura y es la única que conoce Sequelize
 */
class AdvisorRepositoryImpl extends AdvisorRepositoryPort {
    /**
     * Busca un advisor por su ID de usuario
     * @param {number} userId - ID del usuario asociado
     * @returns {Promise<Object|null>} Advisor encontrado o null
     */
    async findByUserId(userId) {
        if (!userId) {
            return null;
        }

        const advisor = await AdvisorModel.findByUserId(userId);
        return advisor ? advisor.toJSON() : null;
    }

    /**
     * Busca un advisor por su ID
     * @param {number} advisorId - ID del advisor
     * @returns {Promise<Object|null>} Advisor encontrado o null
     */
    async findById(advisorId) {
        if (!advisorId) {
            return null;
        }

        const advisor = await AdvisorModel.findByPk(advisorId);
        return advisor ? advisor.toJSON() : null;
    }

    /**
     * Busca advisors activos por tenant
     * @param {number} tenantId - ID del tenant
     * @returns {Promise<Array>} Lista de advisors activos
     */
    async findActiveByTenant(tenantId) {
        if (!tenantId) {
            return [];
        }

        const advisors = await AdvisorModel.findActiveByTenant(tenantId);
        return advisors.map(advisor => advisor.toJSON());
    }
}

module.exports = AdvisorRepositoryImpl;
