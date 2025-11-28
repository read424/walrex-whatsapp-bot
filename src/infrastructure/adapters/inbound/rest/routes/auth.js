const express = require('express');
const router = express.Router();

/**
 * Rutas REST para Autenticación
 *
 * Este archivo SOLO define rutas y las mapea al controlador.
 * NO contiene lógica de negocio, validaciones ni manejo de errores.
 *
 * El controlador se inyecta a través de setAuthController()
 */

let authController = null;

/**
 * Inyecta el controlador (llamado desde el composition root)
 */
function setAuthController(controller) {
    authController = controller;
}

/**
 * Middleware para verificar que el controlador esté inyectado
 */
function ensureControllerInjected(req, res, next) {
    if (!authController) {
        return res.status(500).json({
            success: false,
            error: {
                message: 'AuthController no ha sido inyectado',
                code: 'CONTROLLER_NOT_INITIALIZED'
            }
        });
    }
    next();
}

// Aplicar middleware a todas las rutas
router.use(ensureControllerInjected);

/**
 * POST /api/auth/login
 * Autenticar usuario empleado
 */
router.post('/login', (req, res) => {
    authController.login(req, res);
});

module.exports = router;
module.exports.setAuthController = setAuthController;