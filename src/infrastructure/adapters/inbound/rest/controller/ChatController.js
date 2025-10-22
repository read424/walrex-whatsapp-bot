const {
    SessionNotFoundException,
    SessionClosedException,
    ConnectionUnavailableException,
    InvalidMessageException,
    ContactNotFoundException,
    ContactAlreadyExistsException,
    InvalidUpdateDataException
} = require('../../../../../domain/exceptions/ChatExceptions');
const { IllegalArgumentException } = require('../../../../../domain/exceptions');

/**
 * Controlador REST para endpoints de Chat
 *
 * Responsabilidad:
 * - Recibir requests HTTP
 * - Extraer y validar parámetros de entrada (query, params, body, headers)
 * - Delegar lógica de negocio a los casos de uso
 * - Transformar respuestas de casos de uso a formato HTTP
 * - Manejar excepciones de dominio y convertirlas a códigos HTTP apropiados
 *
 * Este controlador NO contiene lógica de negocio, solo orquestación HTTP
 */
class ChatController {
    /**
     * Constructor con inyección de dependencias
     * @param {Object} dependencies - Dependencias del controlador
     * @param {Object} dependencies.getActiveConversationsUseCase - Caso de uso para conversaciones activas
     * @param {Object} dependencies.getChatSessionsUseCase - Caso de uso para obtener sesiones
     * @param {Object} dependencies.getChatMessagesUseCase - Caso de uso para obtener mensajes
     * @param {Object} dependencies.sendChatMessageUseCase - Caso de uso para enviar mensajes
     * @param {Object} dependencies.updateChatSessionUseCase - Caso de uso para actualizar sesiones
     * @param {Object} dependencies.manageContactsUseCase - Caso de uso para gestionar contactos
     * @param {Object} dependencies.logger - Adaptador de logging
     */
    constructor({
        getActiveConversationsUseCase,
        getChatSessionsUseCase,
        getChatMessagesUseCase,
        getConversationMessagesUseCase,
        sendChatMessageUseCase,
        updateChatSessionUseCase,
        manageContactsUseCase,
        logger
    }) {
        // Validar dependencias requeridas
        if (!getActiveConversationsUseCase) {
            throw new Error('getActiveConversationsUseCase is required');
        }
        if (!getChatSessionsUseCase) {
            throw new Error('getChatSessionsUseCase is required');
        }
        if (!getChatMessagesUseCase) {
            throw new Error('getChatMessagesUseCase is required');
        }
        // Estos son opcionales por ahora hasta que se refactorice el flujo de inicialización
        // if (!sendChatMessageUseCase) {
        //     throw new Error('sendChatMessageUseCase is required');
        // }
        // if (!updateChatSessionUseCase) {
        //     throw new Error('updateChatSessionUseCase is required');
        // }
        if (!manageContactsUseCase) {
            throw new Error('manageContactsUseCase is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.getActiveConversationsUseCase = getActiveConversationsUseCase;
        this.getChatSessionsUseCase = getChatSessionsUseCase;
        this.getChatMessagesUseCase = getChatMessagesUseCase;
        this.getConversationMessagesUseCase = getConversationMessagesUseCase;
        this.sendChatMessageUseCase = sendChatMessageUseCase;
        this.updateChatSessionUseCase = updateChatSessionUseCase;
        this.manageContactsUseCase = manageContactsUseCase;
        this.logger = logger;
    }

    /**
     * GET /api/chat/actives
     * Obtiene conversaciones activas
     */
    async getActiveConversations(req, res) {
        const startTime = Date.now();

        try {
            const tenantId = req.headers['x-tenant-id'];

            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'tenantId is required',
                        code: 'MISSING_TENANT_ID'
                    }
                });
            }

            const filters = {};
            if (req.query.status) filters.status = req.query.status;
            if (req.query.assignedAgentId) filters.assignedAgentId = parseInt(req.query.assignedAgentId);
            if (req.query.priority) filters.priority = req.query.priority;
            if (req.query.channel) filters.channel = req.query.channel;
            if (req.query.department) filters.department = req.query.department;

            this.logger.info('ChatController', 'GET /actives', {
                tenantId,
                filters,
                ip: req.ip
            });

            const result = await this.getActiveConversationsUseCase.execute({
                tenantId: parseInt(tenantId),
                filters
            });

            if (result.success) {
                this.logger.performance(
                    'ChatController',
                    'getActiveConversations',
                    Date.now() - startTime,
                    { tenantId, conversationsCount: result.metadata.total }
                );
                return res.status(200).json(result);
            } else {
                return res.status(500).json(result);
            }

        } catch (error) {
            return this.handleError(error, res, 'getActiveConversations');
        }
    }

    /**
     * GET /api/chat/sessions
     * Obtiene sesiones de chat con filtros
     */
    async getChatSessions(req, res) {
        try {
            const tenantId = req.headers['x-tenant-id'];
            const { status, limit, offset } = req.query;

            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    message: 'tenantId is required'
                });
            }

            const result = await this.getChatSessionsUseCase.execute({
                tenantId: parseInt(tenantId),
                filters: { status },
                limit: limit ? parseInt(limit) : 50,
                offset: offset ? parseInt(offset) : 0
            });

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            return this.handleError(error, res, 'getChatSessions');
        }
    }

    /**
     * GET /api/chat/sessions/:sessionId/messages
     * Obtiene mensajes de una sesión específica
     */
    async getChatMessages(req, res) {
        try {
            const { sessionId } = req.params;
            const { limit, offset } = req.query;

            const result = await this.getChatMessagesUseCase.execute({
                sessionId: parseInt(sessionId),
                limit: limit ? parseInt(limit) : 50,
                offset: offset ? parseInt(offset) : 0
            });

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            return this.handleError(error, res, 'getChatMessages');
        }
    }

    /**
     * GET /api/conversations/:conversationId/messages
     * Obtiene mensajes de una conversación con paginación completa
     */
    async getConversationMessages(req, res) {
        try {
            const { conversationId } = req.params;
            const { page, limit } = req.query;
            const tenantId = req.headers['x-tenant-id'];

            const result = await this.getConversationMessagesUseCase.execute({
                conversationId: parseInt(conversationId),
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 50,
                tenantId: tenantId ? parseInt(tenantId) : null
            });

            // Retornar en el formato exacto esperado por el frontend
            res.json(result);

        } catch (error) {
            return this.handleError(error, res, 'getConversationMessages');
        }
    }

    /**
     * POST /api/chat/sessions/:sessionId/messages
     * Envía un mensaje en una sesión de chat
     */
    async sendMessage(req, res) {
        try {
            const { sessionId } = req.params;
            const { content, messageType = 'text' } = req.body;
            const advisorId = req.user?.id;

            const message = await this.sendChatMessageUseCase.execute({
                sessionId: parseInt(sessionId),
                content,
                messageType,
                advisorId
            });

            res.json({
                success: true,
                data: message,
                message: 'Mensaje enviado correctamente'
            });

        } catch (error) {
            return this.handleError(error, res, 'sendMessage');
        }
    }

    /**
     * PATCH /api/chat/sessions/:sessionId
     * Actualiza una sesión de chat
     */
    async updateSession(req, res) {
        try {
            const { sessionId } = req.params;
            const { status, handledBy, metadata } = req.body;

            const updates = {};
            if (status !== undefined) updates.status = status;
            if (handledBy !== undefined) updates.handledBy = handledBy;
            if (metadata !== undefined) updates.metadata = metadata;

            const updatedSession = await this.updateChatSessionUseCase.execute({
                sessionId: parseInt(sessionId),
                updates
            });

            res.json({
                success: true,
                data: updatedSession,
                message: 'Sesión actualizada correctamente'
            });

        } catch (error) {
            return this.handleError(error, res, 'updateSession');
        }
    }

    /**
     * GET /api/chat/contacts
     * Obtiene contactos con búsqueda y paginación
     */
    async getContacts(req, res) {
        try {
            const tenantId = req.headers['x-tenant-id'];
            const { search, limit, offset } = req.query;

            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    message: 'tenantId is required'
                });
            }

            const result = await this.manageContactsUseCase.searchContacts({
                tenantId: parseInt(tenantId),
                search,
                limit: limit ? parseInt(limit) : 50,
                offset: offset ? parseInt(offset) : 0
            });

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            return this.handleError(error, res, 'getContacts');
        }
    }

    /**
     * POST /api/chat/contacts
     * Crea un nuevo contacto
     */
    async createContact(req, res) {
        try {
            const tenantId = req.headers['x-tenant-id'];
            const { phoneNumber, name, metadata } = req.body;

            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    message: 'tenantId is required'
                });
            }

            const contact = await this.manageContactsUseCase.createContact({
                tenantId: parseInt(tenantId),
                phoneNumber,
                name,
                metadata
            });

            res.json({
                success: true,
                data: contact,
                message: 'Contacto creado correctamente'
            });

        } catch (error) {
            return this.handleError(error, res, 'createContact');
        }
    }

    /**
     * Maneja errores y los convierte a respuestas HTTP apropiadas
     * @private
     */
    handleError(error, res, operation) {
        this.logger.error('ChatController', `Error in ${operation}`, error);

        // Mapear excepciones de dominio a códigos HTTP
        if (error instanceof SessionNotFoundException || error instanceof ContactNotFoundException) {
            return res.status(404).json({
                success: false,
                message: error.message,
                code: error.code
            });
        }

        if (error instanceof InvalidMessageException ||
            error instanceof InvalidUpdateDataException ||
            error instanceof IllegalArgumentException) {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: error.code
            });
        }

        if (error instanceof SessionClosedException) {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: error.code
            });
        }

        if (error instanceof ConnectionUnavailableException) {
            return res.status(503).json({
                success: false,
                message: error.message,
                code: error.code
            });
        }

        if (error instanceof ContactAlreadyExistsException) {
            return res.status(409).json({
                success: false,
                message: error.message,
                code: error.code
            });
        }

        // Error genérico
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            code: 'INTERNAL_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

module.exports = ChatController;