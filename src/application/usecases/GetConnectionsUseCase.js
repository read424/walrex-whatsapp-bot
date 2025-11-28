const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Obtener conexiones
 * Recupera todas las conexiones de un tenant con filtros opcionales
 */
class GetConnectionsUseCase {
    /**
     * @param {ConnectionRepositoryPort} connectionRepository - Puerto de repositorio inyectado
     * @param {LoggerPort} logger - Puerto de logger inyectado
     */
    constructor(connectionRepository, logger) {
        this.connectionRepository = connectionRepository;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso de obtención de conexiones
     * @param {Object} params - Parámetros de búsqueda
     * @param {string|number} params.tenantId - ID del tenant
     * @param {Object} params.filters - Filtros opcionales (status, providerType)
     * @returns {Promise<Object>} - Resultado con conexiones y metadata
     */
    async execute({ tenantId, filters = {} }) {
        const startTime = Date.now();

        try {
            // Validar tenantId
            if (!tenantId) {
                throw new IllegalArgumentException('tenantId es requerido');
            }

            this.logger.info('GetConnectionsUseCase', 'Fetching connections', {
                tenantId,
                filters
            });

            // Obtener conexiones del repositorio
            const connections = await this.connectionRepository.findByTenant(
                tenantId,
                filters
            );

            // Calcular estadísticas
            const statistics = this.calculateStatistics(connections);

            this.logger.info('GetConnectionsUseCase', 'Connections fetched successfully', {
                tenantId,
                count: connections.length,
                duration: Date.now() - startTime
            });

            return {
                success: true,
                data: {
                    connections: connections.map(conn => conn.toJSON()),
                    statistics
                },
                metadata: {
                    total: connections.length,
                    filters: filters,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            this.logger.error('GetConnectionsUseCase', 'Error fetching connections', {
                error: error.message,
                stack: error.stack,
                tenantId,
                filters,
                duration: Date.now() - startTime
            });

            throw error;
        }
    }

    /**
     * Calcula estadísticas de las conexiones
     * @param {Connection[]} connections - Array de conexiones
     * @returns {Object} - Estadísticas calculadas
     */
    calculateStatistics(connections) {
        const byStatus = {};
        const byProvider = {};

        connections.forEach(conn => {
            // Agrupar por estado
            byStatus[conn.status] = (byStatus[conn.status] || 0) + 1;

            // Agrupar por proveedor
            byProvider[conn.providerType] = (byProvider[conn.providerType] || 0) + 1;
        });

        return {
            total: connections.length,
            byStatus,
            byProvider,
            activeCount: connections.filter(c => c.isActive()).length,
            disconnectedCount: connections.filter(c => c.isDisconnected()).length,
            connectingCount: connections.filter(c => c.isConnecting()).length
        };
    }
}

module.exports = GetConnectionsUseCase;