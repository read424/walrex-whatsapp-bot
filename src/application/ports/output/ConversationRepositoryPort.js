class ConversationRepositoryPort {
    /**
     * Obtiene conversaciones activas filtradas por criterios
     * @param {number} tenantId - ID del tenant
     * @param {Object} filters - Filtros opcionales
     * @param {string} filters.status - Estado de la conversación
     * @param {number} filters.assignedAgentId - ID del agente asignado
     * @param {string} filters.priority - Prioridad
     * @param {string} filters.channel - Canal de comunicación
     * @returns {Promise<Conversation[]>} - Lista de conversaciones
     */
    async findActiveConversations(tenantId, filters = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Obtiene una conversación por ID
     * @param {number} conversationId - ID de la conversación
     * @param {number} tenantId - ID del tenant
     * @returns {Promise<Conversation|null>} - Conversación o null
     */
    async findById(conversationId, tenantId) {
        throw new Error('Method not implemented');
    }

    /**
     * Obtiene el conteo de mensajes no leídos de una conversación
     * @param {number} conversationId - ID de la conversación
     * @returns {Promise<number>} - Cantidad de mensajes no leídos
     */
    async countUnreadMessages(conversationId) {
        throw new Error('Method not implemented');
    }

    /**
     * Actualiza el estado de una conversación
     * @param {number} conversationId - ID de la conversación
     * @param {string} status - Nuevo estado
     * @returns {Promise<boolean>} - true si se actualizó correctamente
     */
    async updateStatus(conversationId, status) {
        throw new Error('Method not implemented');
    }

    /**
     * Asigna una conversación a un agente
     * @param {number} conversationId - ID de la conversación
     * @param {number} agentId - ID del agente
     * @returns {Promise<boolean>} - true si se asignó correctamente
     */
    async assignToAgent(conversationId, agentId) {
        throw new Error('Method not implemented');
    }
}

module.exports = ConversationRepositoryPort;