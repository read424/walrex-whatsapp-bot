const { SessionNotFoundException } = require('../../domain/exceptions/ChatExceptions');
const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Obtener mensajes de una sesión de chat
 *
 * Responsabilidad:
 * - Orquestar la obtención de mensajes de una sesión específica
 * - Validar que la sesión existe
 * - Validar parámetros de paginación
 * - Retornar mensajes ordenados con paginación
 *
 * Dependencias inyectadas:
 * - chatSessionRepository: Para validar que la sesión existe
 * - chatMessageRepository: Para obtener los mensajes
 * - logger: Para registrar operaciones y errores
 */
class GetChatMessagesUseCase {
    constructor(chatSessionRepository, chatMessageRepository, logger) {
        if (!chatSessionRepository) {
            throw new Error('chatSessionRepository is required');
        }
        if (!chatMessageRepository) {
            throw new Error('chatMessageRepository is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.chatSessionRepository = chatSessionRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso de obtención de mensajes
     *
     * @param {Object} params - Parámetros del caso de uso
     * @param {number} params.sessionId - ID de la sesión
     * @param {number} [params.limit=50] - Límite de resultados
     * @param {number} [params.offset=0] - Offset para paginación
     * @returns {Promise<Object>} - Resultado con mensajes y metadatos de paginación
     * @throws {SessionNotFoundException} - Si la sesión no existe
     * @throws {IllegalArgumentException} - Si los parámetros son inválidos
     */
    async execute({ sessionId, limit = 50, offset = 0 }) {
        this.logger.info('GetChatMessagesUseCase', 'Getting chat messages', {
            sessionId,
            limit,
            offset
        });

        // 1. Validar sessionId
        this.validateSessionId(sessionId);

        // 2. Validar que la sesión existe
        await this.validateSessionExists(sessionId);

        // 3. Validar y normalizar parámetros de paginación
        const normalizedLimit = this.validateAndNormalizeLimit(limit);
        const normalizedOffset = this.validateAndNormalizeOffset(offset);

        // 4. Obtener mensajes del repositorio
        const messages = await this.chatMessageRepository.findBySession(
            sessionId,
            normalizedLimit,
            normalizedOffset
        );

        this.logger.info('GetChatMessagesUseCase', 'Messages retrieved successfully', {
            sessionId,
            count: messages.length
        });

        // 5. Retornar resultado con metadatos
        return {
            data: messages,
            pagination: {
                limit: normalizedLimit,
                offset: normalizedOffset,
                total: messages.length
            }
        };
    }

    /**
     * Valida el sessionId
     * @private
     */
    validateSessionId(sessionId) {
        if (!sessionId) {
            throw new IllegalArgumentException('sessionId is required');
        }

        const numSessionId = parseInt(sessionId, 10);
        if (isNaN(numSessionId) || numSessionId <= 0) {
            throw new IllegalArgumentException('sessionId must be a positive number');
        }
    }

    /**
     * Valida que la sesión existe
     * @private
     */
    async validateSessionExists(sessionId) {
        const session = await this.chatSessionRepository.findById(sessionId);

        if (!session) {
            this.logger.warn('GetChatMessagesUseCase', 'Session not found', { sessionId });
            throw new SessionNotFoundException(`Session ${sessionId} not found`);
        }
    }

    /**
     * Valida y normaliza el límite de resultados
     * @private
     */
    validateAndNormalizeLimit(limit) {
        const numLimit = parseInt(limit, 10);

        if (isNaN(numLimit) || numLimit < 1) {
            this.logger.warn('GetChatMessagesUseCase', 'Invalid limit, using default', { limit });
            return 50; // Default
        }

        // Aplicar límite máximo (regla de negocio)
        const MAX_LIMIT = 200;
        if (numLimit > MAX_LIMIT) {
            this.logger.warn('GetChatMessagesUseCase', 'Limit exceeds maximum, capping', {
                requested: numLimit,
                max: MAX_LIMIT
            });
            return MAX_LIMIT;
        }

        return numLimit;
    }

    /**
     * Valida y normaliza el offset
     * @private
     */
    validateAndNormalizeOffset(offset) {
        const numOffset = parseInt(offset, 10);

        if (isNaN(numOffset) || numOffset < 0) {
            this.logger.warn('GetChatMessagesUseCase', 'Invalid offset, using default', { offset });
            return 0; // Default
        }

        return numOffset;
    }
}

module.exports = GetChatMessagesUseCase;