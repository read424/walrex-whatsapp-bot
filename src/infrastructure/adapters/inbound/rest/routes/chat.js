const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureTenantId } = require('../middleware/authMiddleware');

/**
 * Rutas REST para módulo de Chat
 *
 * Este archivo solo define las rutas y delega toda la lógica al ChatController.
 * NO contiene lógica de negocio, validaciones, ni acceso a datos.
 *
 * El controlador será inyectado en tiempo de ejecución desde la factory.
 */

// El controlador será inyectado cuando se configure el router
// Ver: src/infrastructure/factories/ChatControllerFactory.js (a crear)
let chatController = null;

/**
 * Función para configurar el controlador
 * Debe ser llamada antes de usar las rutas
 */
function setChatController(controller) {
    chatController = controller;
}

/**
 * Middleware para verificar que el controlador esté configurado
 */
function ensureControllerExists(req, res, next) {
    if (!chatController) {
        return res.status(500).json({
            success: false,
            message: 'ChatController not initialized',
            code: 'CONTROLLER_NOT_INITIALIZED'
        });
    }
    next();
}

// Aplicar middleware a todas las rutas
router.use(ensureControllerExists);

/**
 * GET /api/chat/actives
 * Obtener conversaciones activas con filtros
 */
router.get('/actives', (req, res) => {
    chatController.getActiveConversations(req, res);
});

/**
 * GET /api/chat/sessions
 * Obtener sesiones de chat con filtros y paginación
 */
router.get('/sessions', (req, res) => {
    chatController.getChatSessions(req, res);
});

/**
 * GET /api/chat/sessions/:sessionId/messages
 * Obtener mensajes de una sesión específica
 */
router.get('/sessions/:sessionId/messages', (req, res) => {
    chatController.getChatMessages(req, res);
});

/**
 * POST /api/chat/sessions/:sessionId/messages
 * Enviar mensaje en una sesión de chat
 */
router.post('/sessions/:sessionId/messages', (req, res) => {
    chatController.sendMessage(req, res);
});

/**
 * PATCH /api/chat/sessions/:sessionId
 * Actualizar sesión de chat (estado, asignación, metadata)
 */
router.patch('/sessions/:sessionId', (req, res) => {
    chatController.updateSession(req, res);
});

/**
 * GET /api/chat/contacts
 * Obtener contactos con búsqueda y paginación
 */
router.get('/contacts', (req, res) => {
    chatController.getContacts(req, res);
});

/**
 * POST /api/chat/contacts
 * Crear nuevo contacto
 */
router.post('/contacts', (req, res) => {
    chatController.createContact(req, res);
});

router.post('/send-message', ensureAuthenticated, ensureTenantId, (req, res) => {
    chatController.sendMessageToConversation(req, res);
});

module.exports = router;
module.exports.setChatController = setChatController;