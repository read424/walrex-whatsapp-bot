const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Obtener lista de conexiones de canales
 *
 * Responsabilidad:
 * - Validar filtros de entrada
 * - Obtener conexiones del tenant con filtros aplicados
 * - Aplicar paginación
 * - Formatear respuesta
 *
 * Dependencias:
 * - channelConnectionRepository: Para consultar conexiones
 * - logger: Para registrar operaciones
 */
class GetChannelConnectionsUseCase {
    constructor({ channelConnectionRepository, logger }) {
        if (!channelConnectionRepository) {
            throw new Error('channelConnectionRepository is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.channelConnectionRepository = channelConnectionRepository;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso para listar conexiones
     *
     * @param {Object} params - Parámetros de búsqueda
     * @param {number} params.tenantId - ID del tenant
     * @param {string} params.channelType - Filtro por tipo de canal (opcional)
     * @param {string} params.status - Filtro por estado (opcional)
     * @param {boolean} params.isActive - Filtro por activo/inactivo (opcional)
     * @param {number} params.departmentId - Filtro por departamento (opcional)
     * @param {number} params.page - Número de página (default: 1)
     * @param {number} params.limit - Items por página (default: 20, max: 100)
     *
     * @returns {Promise<Object>} - Lista de conexiones con paginación
     */
    async execute({
        tenantId,
        channelType = null,
        status = null,
        isActive = null,
        departmentId = null,
        page = 1,
        limit = 20
    }) {
        const startTime = Date.now();

        this.logger.info('GetChannelConnectionsUseCase', 'Getting connections list', {
            tenantId,
            filters: { channelType, status, isActive, departmentId },
            pagination: { page, limit }
        });

        try {
            // Validar parámetros
            this.validateParams({ tenantId, page, limit, channelType, status });

            // Construir filtros
            const filters = this.buildFilters({
                channelType,
                status,
                isActive,
                departmentId
            });

            // Obtener conexiones del repositorio
            const connections = await this.channelConnectionRepository.findByTenant(
                tenantId,
                filters
            );

            // Aplicar paginación en memoria (o puedes moverla al repositorio)
            const paginatedResult = this.paginateResults(connections, page, limit);

            // Formatear respuesta
            const formattedConnections = paginatedResult.data.map(conn =>
                this.formatConnectionForList(conn)
            );

            this.logger.info('GetChannelConnectionsUseCase', 'Connections retrieved successfully', {
                tenantId,
                totalFound: connections.length,
                returned: formattedConnections.length,
                duration: Date.now() - startTime
            });

            return {
                success: true,
                data: {
                    connections: formattedConnections,
                    pagination: {
                        page: paginatedResult.page,
                        limit: paginatedResult.limit,
                        totalItems: paginatedResult.totalItems,
                        totalPages: paginatedResult.totalPages
                    }
                }
            };

        } catch (error) {
            this.logger.error('GetChannelConnectionsUseCase', 'Error getting connections', error, {
                tenantId
            });
            throw error;
        }
    }

    /**
     * Valida los parámetros de entrada
     * @private
     */
    validateParams({ tenantId, page, limit, channelType, status }) {
        if (!tenantId || typeof tenantId !== 'number') {
            throw new IllegalArgumentException('tenantId is required and must be a number');
        }

        if (page < 1) {
            throw new IllegalArgumentException('page must be greater than 0');
        }

        if (limit < 1 || limit > 100) {
            throw new IllegalArgumentException('limit must be between 1 and 100');
        }

        // Validar channelType si se proporciona
        if (channelType) {
            const validChannelTypes = [
                'whatsapp_web',
                'whatsapp_api',
                'instagram_direct',
                'facebook_messenger',
                'telegram',
                'webchat'
            ];

            if (!validChannelTypes.includes(channelType)) {
                throw new IllegalArgumentException(
                    `Invalid channelType. Must be one of: ${validChannelTypes.join(', ')}`
                );
            }
        }

        // Validar status si se proporciona
        if (status) {
            const validStatuses = ['active', 'inactive', 'connecting', 'disconnected', 'authenticated', 'error'];

            if (!validStatuses.includes(status)) {
                throw new IllegalArgumentException(
                    `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                );
            }
        }
    }

    /**
     * Construye objeto de filtros limpio
     * @private
     */
    buildFilters({ channelType, status, isActive, departmentId }) {
        const filters = {};

        if (channelType) {
            filters.channelType = channelType;
        }

        if (status) {
            filters.status = status;
        }

        if (isActive !== null && isActive !== undefined) {
            // Convertir string a boolean si es necesario
            if (typeof isActive === 'string') {
                filters.isActive = isActive === 'true';
            } else {
                filters.isActive = isActive;
            }
        }

        if (departmentId) {
            filters.departmentId = parseInt(departmentId, 10);
        }

        return filters;
    }

    /**
     * Aplica paginación a los resultados
     * @private
     */
    paginateResults(connections, page, limit) {
        const totalItems = connections.length;
        const totalPages = Math.ceil(totalItems / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        return {
            data: connections.slice(startIndex, endIndex),
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            totalItems,
            totalPages
        };
    }

    /**
     * Formatea una conexión para la lista (oculta información sensible)
     * @private
     */
    formatConnectionForList(connection) {
        return {
            id: connection.id,
            connectionName: connection.connectionName,
            channelType: connection.channelType,
            status: connection.status,
            isActive: connection.isActive,
            departmentId: connection.departmentId,
            lastSeen: connection.lastSeen,
            lastError: connection.lastError,
            connectionAttempts: connection.connectionAttempts,
            createdAt: connection.createdAt,
            updatedAt: connection.updatedAt,
            // Información resumida de metadata (sin exponer tokens/credenciales)
            summary: {
                hasPhoneNumber: !!(connection.channelConfig?.phoneNumber),
                messagesCount: connection.connectionMetadata?.messagesCount || 0,
                activeConversations: connection.connectionMetadata?.activeConversations || 0
            }
        };
    }
}

module.exports = GetChannelConnectionsUseCase;
