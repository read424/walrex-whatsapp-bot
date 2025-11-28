const express = require('express');
const router = express.Router();
const ChatServiceFactory = require('../../../../factories/ChatServiceFactory');
const { ensureAuthenticated, ensureTenantId } = require('../middleware/authMiddleware');

/**
 * Rutas REST para módulo de Inbox (Conversaciones)
 *
 * Este archivo define rutas para el manejo de conversaciones.
 * El controlador será inyectado en tiempo de ejecución.
 */

// El controlador será inyectado cuando se configure el router
let chatController = null;

/**
 * Función para configurar el controlador
 * Debe ser llamada antes de usar las rutas
 */
function setChatController(controller) {
    chatController = controller;
}

/**
 * GET /api/inbox/conversations
 * Lista conversaciones con filtros (usado por useInbox y useConversations)
 */
router.get('/conversations', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;

        const tenantId = req.headers['x-tenant-id'];
        console.log('req.headers', req.headers, tenantId);

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                error: 'tenantId is required'
            });
        }

        // Construir filtros desde query params
        const filters = {};
        if (req.query.status && req.query.status !== 'all') {
            filters.status = req.query.status;
        }
        if (req.query.assignedTo) {
            filters.assignedAgentId = req.query.assignedTo;
        }
        if (req.query.priority && req.query.priority !== 'all') {
            filters.priority = req.query.priority;
        }
        if (req.query.channel && req.query.channel !== 'all') {
            filters.channel = req.query.channel;
        }
        if (req.query.department && req.query.department !== 'all') {
            filters.department = req.query.department;
        }
        if (req.query.hasUnread === 'true') {
            filters.hasUnread = true;
        }

        const chatService = ChatServiceFactory.create(req.webSocketAdapter);
        const conversations = await chatService.getConversations(tenantId, filters);

        // Aplicar paginación en memoria (o mejor en la BD)
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        const paginatedConversations = conversations.slice(startIndex, endIndex);

        res.json({
            conversations: paginatedConversations,
            total: conversations.length,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(conversations.length / parseInt(limit)),
            hasMore: endIndex < conversations.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/inbox/conversations/:conversationId/messages
 * Obtiene mensajes de una conversación específica
 * Ahora delega al ChatController que usa el GetConversationMessagesUseCase
 */
router.get('/conversations/:conversationId/messages', (req, res) => {
    if (chatController) {
        // Delegar al ChatController que implementa el caso de uso correcto
        chatController.getConversationMessages(req, res);
    } else {
        // Fallback al método antiguo si no hay controlador configurado
        legacyGetConversationMessages(req, res);
    }
});

/**
 * POST /api/inbox/conversations/:conversationId/messages
 * Envía un mensaje a una conversación específica
 *
 * Requiere:
 * - Bearer token en header Authorization
 * - X-Tenant-Id en headers
 *
 * Body:
 * {
 *   "content": "string",
 *   "type": "text" | "image" | "file" | "audio" | "video" | "location" | "contact",
 *   "replyTo": "string (opcional)",
 *   "metadata": { object opcional }
 * }
 */
router.post('/conversations/:conversationId/messages', ensureAuthenticated, ensureTenantId, (req, res) => {
    if (!chatController) {
        return res.status(500).json({
            success: false,
            message: 'ChatController not initialized',
            code: 'CONTROLLER_NOT_INITIALIZED'
        });
    }

    // Adaptar el request para que el controlador reciba conversationId desde params
    // El ChatController espera conversationId en el body, así que lo agregamos
    req.body.conversationId = req.params.conversationId;

    // Delegar al ChatController
    chatController.sendMessageToConversation(req, res);
});

/**
 * Método legacy para obtener mensajes (se mantiene como fallback)
 * @private
 */
async function legacyGetConversationMessages(req, res) {
    try {
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const chatService = ChatServiceFactory.create(req.webSocketAdapter);
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const messages = await chatService.getChatMessages(
            conversationId,
            parseInt(limit),
            offset
        );

        res.json({
            messages,
            total: messages.length, // TODO: Get real count from DB
            page: parseInt(page),
            limit: parseInt(limit),
            hasMore: messages.length === parseInt(limit)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = router;
module.exports.setChatController = setChatController;