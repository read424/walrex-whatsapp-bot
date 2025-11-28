/**
 * Controlador REST para endpoints de Connections
 * Responsabilidades:
 * - Extraer parámetros HTTP
 * - Llamar casos de uso inyectados
 * - Mapear respuestas a HTTP
 * - Manejo de errores HTTP
 *
 * NO contiene lógica de negocio ni validaciones de negocio
 */
class ConnectionController {
    /**
     * @param {CreateConnectionUseCase} createConnectionUseCase - Caso de uso inyectado
     * @param {UpdateConnectionUseCase} updateConnectionUseCase - Caso de uso inyectado
     * @param {GetConnectionsUseCase} getConnectionsUseCase - Caso de uso inyectado
     * @param {RestartConnectionUseCase} restartConnectionUseCase - Caso de uso inyectado
     * @param {LoggerPort} logger - Puerto de logger inyectado
     */
    constructor(
        createConnectionUseCase,
        updateConnectionUseCase,
        getConnectionsUseCase,
        restartConnectionUseCase,
        logger
    ) {
        this.createConnectionUseCase = createConnectionUseCase;
        this.updateConnectionUseCase = updateConnectionUseCase;
        this.getConnectionsUseCase = getConnectionsUseCase;
        this.restartConnectionUseCase = restartConnectionUseCase;
        this.logger = logger;
    }

    /**
     * POST /api/connections
     * Crear nueva conexión
     */
    async createConnection(req, res) {
        try {
            const {
                name,
                greetingMessage,
                farewellMessage,
                department,
                botResetMinutes
            } = req.body;

            // Obtener tenantId del contexto
            const tenantId = req.tenantId || req.headers['x-tenant-id'] || 'tenant_001';

            this.logger.info('ConnectionController', 'Create connection request', {
                name,
                department,
                tenantId,
                correlationId: req.correlationId
            });

            // Ejecutar caso de uso
            const result = await this.createConnectionUseCase.execute({
                connectionName: name,
                department,
                tenantId,
                welcomeMessage: greetingMessage,
                goodbyeMessage: farewellMessage,
                chatbotTimeout: botResetMinutes || 30,
                providerType: 'whatsapp'
            });

            this.logger.info('ConnectionController', 'Connection created successfully', {
                connectionId: result.id,
                correlationId: req.correlationId
            });

            res.status(201).json({
                success: true,
                message: 'Conexión creada exitosamente',
                data: {
                    id: result.id,
                    name: result.connectionName,
                    department: result.department,
                    status: result.status,
                    providerType: result.providerType,
                    createdAt: result.createdAt
                }
            });

        } catch (error) {
            this.handleError(error, req, res, 'createConnection');
        }
    }

    /**
     * GET /api/connections
     * Obtener todas las conexiones
     */
    async getConnections(req, res) {
        try {
            const tenantId = req.tenantId || req.headers['x-tenant-id'] || 1;
            const { provider, status } = req.query;

            this.logger.info('ConnectionController', 'Get connections request', {
                tenantId,
                filters: { provider, status },
                correlationId: req.correlationId
            });

            // Construir filtros
            const filters = {};
            if (provider) filters.providerType = provider;
            if (status) filters.status = status;

            // Ejecutar caso de uso
            const result = await this.getConnectionsUseCase.execute({
                tenantId,
                filters
            });

            this.logger.info('ConnectionController', 'Connections fetched successfully', {
                count: result.metadata.total,
                correlationId: req.correlationId
            });

            res.status(200).json(result);

        } catch (error) {
            this.handleError(error, req, res, 'getConnections');
        }
    }

    /**
     * GET /api/connections/:id
     * Obtener una conexión por ID
     */
    async getConnectionById(req, res) {
        try {
            const connectionId = parseInt(req.params.id);

            this.logger.info('ConnectionController', 'Get connection by ID request', {
                connectionId,
                correlationId: req.correlationId
            });

            // Nota: Necesitarías crear un GetConnectionByIdUseCase
            // Por ahora usamos el repository directamente (temporal)
            // TODO: Crear GetConnectionByIdUseCase

            res.status(501).json({
                success: false,
                message: 'Endpoint en desarrollo'
            });

        } catch (error) {
            this.handleError(error, req, res, 'getConnectionById');
        }
    }

    /**
     * PUT /api/connections/:id
     * Actualizar una conexión
     */
    async updateConnection(req, res) {
        try {
            const connectionId = parseInt(req.params.id);
            const {
                greetingMessage,
                farewellMessage,
                botResetMinutes,
                department
            } = req.body;

            this.logger.info('ConnectionController', 'Update connection request', {
                connectionId,
                correlationId: req.correlationId
            });

            // Ejecutar caso de uso
            const result = await this.updateConnectionUseCase.execute({
                connectionId,
                welcomeMessage: greetingMessage,
                goodbyeMessage: farewellMessage,
                chatbotTimeout: botResetMinutes,
                department
            });

            this.logger.info('ConnectionController', 'Connection updated successfully', {
                connectionId: result.id,
                correlationId: req.correlationId
            });

            res.status(200).json({
                success: true,
                message: 'Conexión actualizada exitosamente',
                data: {
                    id: result.id,
                    name: result.connectionName,
                    department: result.department,
                    status: result.status,
                    updatedAt: result.updatedAt
                }
            });

        } catch (error) {
            this.handleError(error, req, res, 'updateConnection');
        }
    }

    /**
     * POST /api/connections/:id/restart
     * Reiniciar una conexión
     */
    async restartConnection(req, res) {
        try {
            const connectionId = parseInt(req.params.id);

            this.logger.info('ConnectionController', 'Restart connection request', {
                connectionId,
                correlationId: req.correlationId
            });

            // Ejecutar caso de uso
            const result = await this.restartConnectionUseCase.execute({
                connectionId
            });

            this.logger.info('ConnectionController', 'Connection restarted successfully', {
                connectionId: result.id,
                newStatus: result.status,
                correlationId: req.correlationId
            });

            res.status(200).json({
                success: true,
                message: 'Conexión reiniciada exitosamente',
                data: {
                    id: result.id,
                    name: result.connectionName,
                    status: result.status,
                    updatedAt: result.updatedAt
                }
            });

        } catch (error) {
            this.handleError(error, req, res, 'restartConnection');
        }
    }

    /**
     * DELETE /api/connections/:id
     * Eliminar una conexión
     */
    async deleteConnection(req, res) {
        try {
            const connectionId = parseInt(req.params.id);

            this.logger.info('ConnectionController', 'Delete connection request', {
                connectionId,
                correlationId: req.correlationId
            });

            // TODO: Crear DeleteConnectionUseCase

            res.status(501).json({
                success: false,
                message: 'Endpoint en desarrollo'
            });

        } catch (error) {
            this.handleError(error, req, res, 'deleteConnection');
        }
    }

    /**
     * Manejo centralizado de errores HTTP
     */
    handleError(error, req, res, operation) {
        this.logger.error('ConnectionController', `Error in ${operation}`, {
            error: error.message,
            stack: error.stack,
            correlationId: req.correlationId
        });

        // Mapear excepciones de dominio a códigos HTTP
        if (error.name === 'IllegalArgumentException') {
            return res.status(400).json({
                success: false,
                message: error.message,
                error: {
                    code: 'INVALID_INPUT',
                    details: error.message
                }
            });
        }

        if (error.message && error.message.includes('Ya existe una conexión')) {
            return res.status(409).json({
                success: false,
                message: error.message,
                error: {
                    code: 'DUPLICATE_CONNECTION',
                    details: error.message
                }
            });
        }

        if (error.message && error.message.includes('No se encontró')) {
            return res.status(404).json({
                success: false,
                message: error.message,
                error: {
                    code: 'NOT_FOUND',
                    details: error.message
                }
            });
        }

        // Error genérico del sistema
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: {
                code: 'INTERNAL_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
}

module.exports = ConnectionController;