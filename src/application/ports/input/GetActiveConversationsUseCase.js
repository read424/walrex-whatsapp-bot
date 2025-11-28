const structuredLogger = require('../../../infrastructure/config/StructuredLogger');

/**
 * Puerto de entrada (Input Port)
 * Interface que define el contrato del caso de uso
 * Los handlers/controllers dependen de esta interface, no de la implementación
*/
class GetActiveConversationsUseCase {
    /**
     * @param {ConversationRepositoryPort} conversationRepository
    */
    constructor(conversationRepository) {
        this.conversationRepository = conversationRepository;
    }
    /**
     * Ejecuta el caso de uso
     * @param {Object} params - Parámetros de búsqueda
     * @param {number} params.tenantId - ID del tenant (obligatorio)
     * @param {Object} params.filters - Filtros opcionales
     * @param {string} params.filters.status - Estado ('active', 'pending', 'closed')
     * @param {number} params.filters.assignedAgentId - ID del agente
     * @param {string} params.filters.priority - Prioridad ('low', 'normal', 'high', 'urgent')
     * @param {string} params.filters.channel - Canal ('whatsapp', 'email', etc)
     * @param {string} params.filters.department - Departamento
     * @returns {Promise<Object>} - Resultado con conversaciones y metadata
    */
    async getConversations({ tenantId, filters = {} }) {
        const startTime = Date.now();

        try {
            // Validar parámetros obligatorios
            if (!tenantId) {
                throw new Error('tenantId is required');
            }

            structuredLogger.info('GetActiveConversationsUseCase', 'Executing use case', {
                tenantId,
                filters
            });

            // Obtener conversaciones del repositorio
            const conversations = await this.conversationRepository.findActiveConversations(
                tenantId,
                filters
            );

            // Calcular estadísticas
            const statistics = this.calculateStatistics(conversations);

            structuredLogger.performance(
                'GetActiveConversationsUseCase',
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
                    conversations: conversations.map(conv => conv.toJSON()),
                    statistics,
                    filters: filters
                },
                metadata: {
                    total: conversations.length,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            structuredLogger.error(
                'GetActiveConversationsUseCase',
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
     * Calcula estadísticas de las conversaciones
     * @param {Conversation[]} conversations
     * @returns {Object} - Estadísticas
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

module.exports = GetActiveConversationsUseCase;