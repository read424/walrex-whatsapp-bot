const GetActiveConversationsUseCasePort = require('../ports/input/GetActiveConversationsUseCase');

/**
 * Caso de uso de aplicación que orquesta la obtención de conversaciones activas
 * ESTE implementa el puerto de entrada
 * USA el servicio de dominio (NO hereda de él)
 */
class GetActiveConversationsUseCase extends GetActiveConversationsUseCasePort {
    /**
     * @param {GetActiveConversationsService} getActiveConversationsService - Servicio de dominio
     */
    constructor(getActiveConversationsService) {
        super();
        this.getActiveConversationsService = getActiveConversationsService;
    }

    /**
     * Ejecuta el caso de uso
     * Delega la lógica de negocio al servicio de dominio
     */
    async execute({ tenantId, filters = {} }) {
        return await this.getActiveConversationsService.getActiveConversations({
            tenantId,
            filters
        });
    }
}

module.exports = GetActiveConversationsUseCase;