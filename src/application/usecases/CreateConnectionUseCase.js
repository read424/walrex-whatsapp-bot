const Connection = require('../../domain/model/Connection');
const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Crear una nueva conexión WhatsApp
 * Orquesta la creación de una conexión validando reglas de negocio
 */
class CreateConnectionUseCase {
    /**
     * @param {ConnectionRepositoryPort} connectionRepository - Puerto de repositorio inyectado
     * @param {LoggerPort} logger - Puerto de logger inyectado
     */
    constructor(connectionRepository, logger) {
        this.connectionRepository = connectionRepository;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso de creación de conexión
     * @param {Object} params - Parámetros de la conexión
     * @param {string} params.connectionName - Nombre de la conexión
     * @param {string} params.department - Departamento
     * @param {string} params.tenantId - ID del tenant
     * @param {string} params.welcomeMessage - Mensaje de bienvenida (opcional)
     * @param {string} params.goodbyeMessage - Mensaje de despedida (opcional)
     * @param {number} params.chatbotTimeout - Timeout del chatbot en minutos (opcional)
     * @param {string} params.providerType - Tipo de proveedor (opcional, default: 'whatsapp')
     * @returns {Promise<Connection>} - Entidad de dominio Connection creada
     */
    async execute({
        connectionName,
        department,
        tenantId,
        welcomeMessage = null,
        goodbyeMessage = null,
        chatbotTimeout = 30,
        providerType = 'whatsapp'
    }) {
        const startTime = Date.now();

        try {
            this.logger.info('CreateConnectionUseCase', 'Creating new connection', {
                connectionName,
                department,
                tenantId
            });

            // Crear entidad de dominio
            const connection = new Connection({
                connectionName: connectionName?.trim(),
                department,
                tenantId,
                welcomeMessage,
                goodbyeMessage,
                chatbotTimeout,
                providerType,
                status: 'inactive'
            });

            // Validar entidad (aplica reglas de negocio)
            connection.validate();

            // Verificar que no exista una conexión con el mismo nombre
            const existing = await this.connectionRepository.findByName(
                connection.connectionName,
                tenantId
            );

            if (existing) {
                throw new IllegalArgumentException(
                    'Ya existe una conexión con este nombre para este tenant'
                );
            }

            // Persistir
            const savedConnection = await this.connectionRepository.create(connection);

            this.logger.info('CreateConnectionUseCase', 'Connection created successfully', {
                connectionId: savedConnection.id,
                connectionName: savedConnection.connectionName,
                tenantId: savedConnection.tenantId,
                duration: Date.now() - startTime
            });

            return savedConnection;

        } catch (error) {
            this.logger.error('CreateConnectionUseCase', 'Error creating connection', {
                error: error.message,
                stack: error.stack,
                connectionName,
                tenantId,
                duration: Date.now() - startTime
            });

            throw error;
        }
    }
}

module.exports = CreateConnectionUseCase;