const express = require('express');
const router = express.Router();

/**
 * Rutas REST para Connections
 *
 * Este archivo SOLO define rutas y las mapea al controlador.
 * NO contiene lógica de negocio, validaciones ni manejo de errores.
 *
 * El controlador se inyecta a través de setConnectionController()
 *
 * ANTES: 364 líneas con lógica de negocio mezclada
 * AHORA: ~70 líneas, solo routing puro
 */

let connectionController = null;

/**
 * Inyecta el controlador (llamado desde el composition root)
 */
function setConnectionController(controller) {
    connectionController = controller;
}

/**
 * Middleware para verificar que el controlador esté inyectado
 */
function ensureControllerInjected(req, res, next) {
    if (!connectionController) {
        return res.status(500).json({
            success: false,
            error: {
                message: 'ConnectionController no ha sido inyectado',
                code: 'CONTROLLER_NOT_INITIALIZED'
            }
        });
    }
    next();
}

// Aplicar middleware a todas las rutas
router.use(ensureControllerInjected);

/**
 * POST /api/connections
 * Crear nueva conexión WhatsApp
 */
router.post('/', (req, res) => {
    connectionController.createConnection(req, res);
});

/**
 * GET /api/connections
 * Obtener todas las conexiones del tenant
 * Query params opcionales: ?provider=whatsapp&status=active
 */
router.get('/', (req, res) => {
    connectionController.getConnections(req, res);
});

/**
 * GET /api/connections/:id
 * Obtener una conexión específica por ID
 */
router.get('/:id', (req, res) => {
    connectionController.getConnectionById(req, res);
});

/**
 * PUT /api/connections/:id
 * Actualizar una conexión existente
 */
router.put('/:id', (req, res) => {
    connectionController.updateConnection(req, res);
});

/**
 * POST /api/connections/:id/restart
 * Reiniciar una conexión (cambiar estado para reconexión)
 */
router.post('/:id/restart', (req, res) => {
    connectionController.restartConnection(req, res);
});

/**
 * DELETE /api/connections/:id
 * Eliminar una conexión
 */
router.delete('/:id', (req, res) => {
    connectionController.deleteConnection(req, res);
});

module.exports = router;
module.exports.setConnectionController = setConnectionController;