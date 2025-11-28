const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Reiniciar una conexión WhatsApp
 * Cambia el estado de la conexión para permitir reconexión
 */
class RestartConnectionUseCase {
    /**
     * @param {ConnectionRepositoryPort} connectionRepository - Puerto de repositorio inyectado
     * @param {LoggerPort} logger - Puerto de logger inyectado
     */
    constructor(connectionRepository, logger) {
        this.connectionRepository = connectionRepository;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso de reinicio de conexión
     * @param {Object} params - Parámetros
     * @param {number} params.connectionId - ID de la conexión a reiniciar
     * @returns {Promise<Connection>} - Entidad de dominio Connection reiniciada
     */
    async execute({ connectionId }) {
        const startTime = Date.now();

        try {
            this.logger.info('RestartConnectionUseCase', 'Restarting connection', {
                connectionId
            });

            // Validar ID
            if (!connectionId || typeof connectionId !== 'number') {
                throw new IllegalArgumentException('ID de conexión inválido');
            }

            // Buscar la conexión
            const connection = await this.connectionRepository.findById(connectionId);

            if (!connection) {
                throw new IllegalArgumentException(
                    `No se encontró una conexión con ID: ${connectionId}`
                );
            }

            // Verificar que la conexión pueda ser reiniciada (regla de negocio)
            if (!connection.canRestart()) {
                throw new IllegalArgumentException(
                    `La conexión en estado '${connection.status}' no puede ser reiniciada. ` +
                    `Solo conexiones en estados: inactive, disconnected, error pueden reiniciarse.`
                );
            }

            // Cambiar estado a 'inactive' para permitir nueva conexión
            connection.changeStatus('inactive');

            // Limpiar QR code anterior
            connection.qrCode = null;

            // Persistir cambios
            const restartedConnection = await this.connectionRepository.update(connection);

            this.logger.info('RestartConnectionUseCase', 'Connection restarted successfully', {
                connectionId: restartedConnection.id,
                newStatus: restartedConnection.status,
                duration: Date.now() - startTime
            });

            return restartedConnection;

        } catch (error) {
            this.logger.error('RestartConnectionUseCase', 'Error restarting connection', {
                error: error.message,
                stack: error.stack,
                connectionId,
                duration: Date.now() - startTime
            });

            throw error;
        }
    }
}

module.exports = RestartConnectionUseCase;