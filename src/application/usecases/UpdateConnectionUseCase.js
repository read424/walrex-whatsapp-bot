const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Actualizar una conexión existente
 * Permite actualizar mensajes, timeout y otros atributos de la conexión
 */
class UpdateConnectionUseCase {
    /**
     * @param {ConnectionRepositoryPort} connectionRepository - Puerto de repositorio inyectado
     * @param {LoggerPort} logger - Puerto de logger inyectado
     */
    constructor(connectionRepository, logger) {
        this.connectionRepository = connectionRepository;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso de actualización de conexión
     * @param {Object} params - Parámetros de actualización
     * @param {number} params.connectionId - ID de la conexión a actualizar
     * @param {string} params.welcomeMessage - Mensaje de bienvenida (opcional)
     * @param {string} params.goodbyeMessage - Mensaje de despedida (opcional)
     * @param {number} params.chatbotTimeout - Timeout del chatbot (opcional)
     * @param {string} params.department - Departamento (opcional)
     * @returns {Promise<Connection>} - Entidad de dominio Connection actualizada
     */
    async execute({
        connectionId,
        welcomeMessage,
        goodbyeMessage,
        chatbotTimeout,
        department
    }) {
        const startTime = Date.now();

        try {
            this.logger.info('UpdateConnectionUseCase', 'Updating connection', {
                connectionId
            });

            // Validar que el ID sea válido
            if (!connectionId || typeof connectionId !== 'number') {
                throw new IllegalArgumentException('ID de conexión inválido');
            }

            // Buscar la conexión existente
            const connection = await this.connectionRepository.findById(connectionId);

            if (!connection) {
                throw new IllegalArgumentException(
                    `No se encontró una conexión con ID: ${connectionId}`
                );
            }

            // Aplicar actualizaciones usando métodos de negocio de la entidad
            if (welcomeMessage !== undefined || goodbyeMessage !== undefined) {
                connection.updateMessages({
                    welcomeMessage,
                    goodbyeMessage
                });
            }

            if (chatbotTimeout !== undefined) {
                connection.updateChatbotTimeout(chatbotTimeout);
            }

            if (department !== undefined) {
                if (!department) {
                    throw new IllegalArgumentException('El departamento no puede estar vacío');
                }
                connection.department = department;
                connection.updatedAt = new Date();
            }

            // Persistir cambios
            const updatedConnection = await this.connectionRepository.update(connection);

            this.logger.info('UpdateConnectionUseCase', 'Connection updated successfully', {
                connectionId: updatedConnection.id,
                duration: Date.now() - startTime
            });

            return updatedConnection;

        } catch (error) {
            this.logger.error('UpdateConnectionUseCase', 'Error updating connection', {
                error: error.message,
                stack: error.stack,
                connectionId,
                duration: Date.now() - startTime
            });

            throw error;
        }
    }
}

module.exports = UpdateConnectionUseCase;