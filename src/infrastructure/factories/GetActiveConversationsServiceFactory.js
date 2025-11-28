/**
 * Factory para crear instancias de GetActiveConversationsService con todas sus dependencias inyectadas
 * Esta clase pertenece a la capa de infraestructura y es responsable de:
 * - Instanciar las implementaciones concretas de los repositorios
 * - Instanciar el adaptador del logger
 * - Inyectar todas las dependencias en el servicio de dominio
 *
 * Este es el único lugar donde se conoce qué implementaciones concretas usar
 */

const GetActiveConversationsService = require('../../domain/service/GetActiveConversationsService');
const ConversationRepositoryImpl = require('../adapters/outbound/persistence/ConversationRepositoryImpl');
const StructuredLoggerAdapter = require('../adapters/outbound/logging/StructuredLoggerAdapter');

class GetActiveConversationsServiceFactory {
    /**
     * Crea una instancia de GetActiveConversationsService con todas sus dependencias inyectadas
     * @returns {GetActiveConversationsService} - Instancia configurada del servicio
     */
    static create() {
        // Instanciar las implementaciones concretas
        const conversationRepository = new ConversationRepositoryImpl();
        const logger = new StructuredLoggerAdapter();

        // Inyectar todas las dependencias en el servicio de dominio
        return new GetActiveConversationsService(conversationRepository, logger);
    }

    /**
     * Crea una instancia de GetActiveConversationsService para testing con dependencias mock
     * @param {Object} mocks - Objetos mock para las dependencias
     * @param {Object} mocks.conversationRepository - Mock del repositorio de conversaciones
     * @param {Object} mocks.logger - Mock del logger
     * @returns {GetActiveConversationsService} - Instancia configurada para testing
     */
    static createForTesting(mocks = {}) {
        const conversationRepository = mocks.conversationRepository || {
            findActiveConversations: async () => []
        };
        const logger = mocks.logger || {
            info: () => {},
            error: () => {},
            warn: () => {},
            debug: () => {},
            performance: () => {}
        };

        return new GetActiveConversationsService(conversationRepository, logger);
    }
}

module.exports = GetActiveConversationsServiceFactory;