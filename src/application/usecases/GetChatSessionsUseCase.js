const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Obtener sesiones de chat
 *
 * Responsabilidad:
 * - Orquestar la obtención de sesiones de chat con filtros
 * - Validar parámetros de entrada (tenantId, paginación, filtros)
 * - Aplicar reglas de negocio para filtrado
 * - Retornar sesiones con paginación
 *
 * Dependencias inyectadas:
 * - chatSessionRepository: Para obtener sesiones
 * - logger: Para registrar operaciones y errores
 */
class GetChatSessionsUseCase {
    constructor(chatSessionRepository, logger) {
        if (!chatSessionRepository) {
            throw new Error('chatSessionRepository is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.chatSessionRepository = chatSessionRepository;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso de obtención de sesiones
     *
     * @param {Object} params - Parámetros del caso de uso
     * @param {number} params.tenantId - ID del tenant
     * @param {Object} [params.filters={}] - Filtros opcionales
     * @param {string} [params.filters.status] - Filtrar por estado
     * @param {number} [params.filters.contactId] - Filtrar por contacto
     * @param {number} [params.filters.handledBy] - Filtrar por asesor
     * @param {number} [params.limit=50] - Límite de resultados
     * @param {number} [params.offset=0] - Offset para paginación
     * @returns {Promise<Object>} - Resultado con sesiones y metadatos de paginación
     * @throws {IllegalArgumentException} - Si los parámetros son inválidos
     */
    async execute({ tenantId, filters = {}, limit = 50, offset = 0 }) {
        this.logger.info('GetChatSessionsUseCase', 'Getting chat sessions', {
            tenantId,
            filters,
            limit,
            offset
        });

        // 1. Validar parámetros obligatorios
        this.validateTenantId(tenantId);

        // 2. Validar y normalizar parámetros de paginación
        const normalizedLimit = this.validateAndNormalizeLimit(limit);
        const normalizedOffset = this.validateAndNormalizeOffset(offset);

        // 3. Validar y normalizar filtros
        const normalizedFilters = this.validateAndNormalizeFilters(filters);

        // 4. Obtener sesiones del repositorio
        const sessions = await this.chatSessionRepository.findByTenant(tenantId, {
            ...normalizedFilters,
            limit: normalizedLimit,
            offset: normalizedOffset
        });

        this.logger.info('GetChatSessionsUseCase', 'Sessions retrieved successfully', {
            tenantId,
            count: sessions.length
        });

        // 5. Retornar resultado con metadatos
        return {
            data: sessions,
            pagination: {
                limit: normalizedLimit,
                offset: normalizedOffset,
                total: sessions.length
            }
        };
    }

    /**
     * Valida el tenantId
     * @private
     */
    validateTenantId(tenantId) {
        if (!tenantId) {
            throw new IllegalArgumentException('tenantId is required');
        }

        if (typeof tenantId !== 'number' || tenantId <= 0) {
            throw new IllegalArgumentException('tenantId must be a positive number');
        }
    }

    /**
     * Valida y normaliza el límite de resultados
     * @private
     */
    validateAndNormalizeLimit(limit) {
        const numLimit = parseInt(limit, 10);

        if (isNaN(numLimit) || numLimit < 1) {
            this.logger.warn('GetChatSessionsUseCase', 'Invalid limit, using default', { limit });
            return 50; // Default
        }

        // Aplicar límite máximo (regla de negocio)
        const MAX_LIMIT = 100;
        if (numLimit > MAX_LIMIT) {
            this.logger.warn('GetChatSessionsUseCase', 'Limit exceeds maximum, capping', {
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
            this.logger.warn('GetChatSessionsUseCase', 'Invalid offset, using default', { offset });
            return 0; // Default
        }

        return numOffset;
    }

    /**
     * Valida y normaliza filtros
     * @private
     */
    validateAndNormalizeFilters(filters) {
        const normalized = {};

        // Filtro por status
        if (filters.status) {
            const validStatuses = ['open', 'waiting', 'closed', 'archived'];
            if (validStatuses.includes(filters.status)) {
                normalized.status = filters.status;
            } else {
                this.logger.warn('GetChatSessionsUseCase', 'Invalid status filter ignored', {
                    status: filters.status
                });
            }
        }

        // Filtro por contactId
        if (filters.contactId) {
            const contactId = parseInt(filters.contactId, 10);
            if (!isNaN(contactId) && contactId > 0) {
                normalized.contactId = contactId;
            } else {
                this.logger.warn('GetChatSessionsUseCase', 'Invalid contactId filter ignored', {
                    contactId: filters.contactId
                });
            }
        }

        // Filtro por handledBy
        if (filters.handledBy !== undefined) {
            if (filters.handledBy === null) {
                // Filtrar sesiones no asignadas
                normalized.handledBy = null;
            } else {
                const handledBy = parseInt(filters.handledBy, 10);
                if (!isNaN(handledBy) && handledBy > 0) {
                    normalized.handledBy = handledBy;
                } else {
                    this.logger.warn('GetChatSessionsUseCase', 'Invalid handledBy filter ignored', {
                        handledBy: filters.handledBy
                    });
                }
            }
        }

        return normalized;
    }
}

module.exports = GetChatSessionsUseCase;