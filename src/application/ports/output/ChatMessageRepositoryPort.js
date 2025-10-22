/**
 * Puerto (interfaz) para el repositorio de mensajes de chat
 * Define el contrato que debe cumplir cualquier implementación de repositorio de mensajes
 */
class ChatMessageRepositoryPort {
    /**
     * Crea un nuevo mensaje de chat
     * @param {Object} messageData - Datos del mensaje
     * @returns {Promise<ChatMessage>} - Entidad ChatMessage creada
     */
    async create(messageData) {
        throw new Error('Method not implemented');
    }

    /**
     * Busca un mensaje por ID con relaciones opcionales
     * @param {number} messageId - ID del mensaje
     * @param {Object} options - Opciones de inclusión (includeContact, includeSession, etc.)
     * @returns {Promise<ChatMessage|null>} - Entidad ChatMessage o null si no existe
     */
    async findById(messageId, options = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Busca mensajes por sesión de chat
     * @param {number} chatSessionId - ID de la sesión de chat
     * @param {number} limit - Límite de resultados
     * @param {number} offset - Offset para paginación
     * @returns {Promise<ChatMessage[]>} - Array de entidades ChatMessage
     */
    async findBySession(chatSessionId, limit = 50, offset = 0) {
        throw new Error('Method not implemented');
    }

    /**
     * Busca un mensaje por ID de WhatsApp
     * @param {string} whatsappMessageId - ID del mensaje en WhatsApp
     * @returns {Promise<ChatMessage|null>} - Entidad ChatMessage o null si no existe
     */
    async findByWhatsappMessageId(whatsappMessageId) {
        throw new Error('Method not implemented');
    }

    /**
     * Actualiza un mensaje existente
     * @param {number} messageId - ID del mensaje
     * @param {Object} messageData - Datos a actualizar
     * @returns {Promise<ChatMessage>} - Entidad ChatMessage actualizada
     */
    async update(messageId, messageData) {
        throw new Error('Method not implemented');
    }

    /**
     * Actualiza el estado de un mensaje por ID de WhatsApp
     * @param {string} whatsappMessageId - ID del mensaje en WhatsApp
     * @param {number} status - Nuevo estado
     * @returns {Promise<ChatMessage|null>} - Entidad ChatMessage actualizada o null
     */
    async updateStatusByWhatsappId(whatsappMessageId, status) {
        throw new Error('Method not implemented');
    }

    /**
     * Busca mensajes por sesión con paginación y cuenta total
     * @param {number} chatSessionId - ID de la sesión de chat
     * @param {number} page - Número de página (1-indexed)
     * @param {number} limit - Límite de resultados por página
     * @returns {Promise<{messages: ChatMessage[], total: number}>} - Mensajes y total
     */
    async findBySessionWithCount(chatSessionId, page = 1, limit = 50) {
        throw new Error('Method not implemented');
    }
}

module.exports = ChatMessageRepositoryPort;