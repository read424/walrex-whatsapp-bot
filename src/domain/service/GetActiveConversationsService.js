/**
 * Servicio de dominio PURO para obtener conversaciones activas
 * Contiene SOLO lógica de negocio
 * NO debe depender de la capa de aplicación
 * Depende de los puertos de salida (ConversationRepositoryPort, LoggerPort)
*/
class GetActiveConversationsService {
    /**
     * @param {ConversationRepositoryPort} conversationRepository - Puerto de salida para conversaciones
     * @param {LoggerPort} logger - Puerto de salida para logging
    */
    constructor(conversationRepository, logger) {
        this.conversationRepository = conversationRepository;
        this.logger = logger;
    }

    /**
     * Obtiene conversaciones activas con lógica de negocio aplicada
     * @param {Object} params - Parámetros de búsqueda
     * @param {number} params.tenantId - ID del tenant (obligatorio)
     * @param {Object} params.filters - Filtros opcionales
     * @returns {Promise<Object>} - Resultado con conversaciones y metadata
    */
    async getActiveConversations({ tenantId, filters = {} }) {
        const startTime = Date.now();

        try {
            // Validar parámetros obligatorios
            if (!tenantId) {
                throw new Error('tenantId is required');
            }

            this.logger.info('GetActiveConversationsService', 'Executing use case', {
                tenantId,
                filters
            });

            // Obtener conversaciones del repositorio (a través del puerto)
            const conversations = await this.conversationRepository.findActiveConversations(
                tenantId,
                filters
            );

            // Aplicar reglas de negocio
            const sortedConversations = this.sortConversationsByPriority(conversations);
            const statistics = this.calculateStatistics(sortedConversations);

            this.logger.performance(
                'GetActiveConversationsService',
                'execute',
                Date.now() - startTime,
                {
                    tenantId,
                    conversationsCount: conversations.length
                }
            );

            return {
                success: true,
                data: {
                    conversations: sortedConversations.map(conv => conv.toJSON()),
                    statistics,
                    filters: filters
                },
                metadata: {
                    total: conversations.length,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            this.logger.error(
                'GetActiveConversationsService',
                'Error executing use case',
                error,
                { tenantId, filters }
            );

            return {
                success: false,
                error: {
                    message: error.message,
                    code: error.code || 'INTERNAL_ERROR'
                }
            };
        }
    }

    /**
     * Regla de negocio: Ordenar conversaciones por prioridad
     * @param {Conversation[]} conversations
     * @returns {Conversation[]}
    */
    sortConversationsByPriority(conversations) {
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        
        return conversations.sort((a, b) => {
            // Primero por prioridad
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            
            // Luego por mensajes no leídos (descendente)
            const unreadDiff = b.unreadCount - a.unreadCount;
            if (unreadDiff !== 0) return unreadDiff;
            
            // Finalmente por fecha de actualización (más reciente primero)
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
    }

    /**
     * Calcula estadísticas de las conversaciones
     * @param {Conversation[]} conversations
     * @returns {Object}
    */
    calculateStatistics(conversations) {
        return {
            total: conversations.length,
            byStatus: this.groupByStatus(conversations),
            byPriority: this.groupByPriority(conversations),
            unassigned: conversations.filter(c => !c.isAssigned()).length,
            withUnreadMessages: conversations.filter(c => c.hasUnreadMessages()).length,
            totalUnreadMessages: conversations.reduce((sum, c) => sum + c.unreadCount, 0)
        };
    }

    /**
     * Agrupa conversaciones por estado
    */
    groupByStatus(conversations) {
        const grouped = {};
        conversations.forEach(conv => {
            grouped[conv.status] = (grouped[conv.status] || 0) + 1;
        });
        return grouped;
    }

    /**
     * Agrupa conversaciones por prioridad
    */
    groupByPriority(conversations) {
        const grouped = {};
        conversations.forEach(conv => {
            grouped[conv.priority] = (grouped[conv.priority] || 0) + 1;
        });
        return grouped;
    }
}

module.exports = GetActiveConversationsService;