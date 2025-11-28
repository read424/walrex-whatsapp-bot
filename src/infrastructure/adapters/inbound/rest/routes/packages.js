const express = require('express');

/**
 * Rutas REST para Packages
 *
 * Este archivo SOLO define rutas y las mapea al controlador.
 * NO contiene lógica de negocio, validaciones ni manejo de errores.
 *
 * El controlador se inyecta a través de setPackageController()
 */

const router = express.Router();
let packageController = null;

/**
 * Inyecta el controlador (llamado desde el composition root)
 */
function setPackageController(controller) {
    packageController = controller;
}

/**
 * Middleware para verificar que el controlador esté inyectado
 */
function ensureControllerInjected(req, res, next) {
    if (!packageController) {
        return res.status(500).json({
            success: false,
            error: {
                message: 'PackageController no ha sido inyectado',
                code: 'CONTROLLER_NOT_INITIALIZED'
            }
        });
    }
    next();
}

// Aplicar middleware a todas las rutas que usan el controlador
router.use('/registry-name', ensureControllerInjected);

/**
 * POST /api/packages/registry-name
 * Registrar nombre de paquete
 */
router.post('/registry-name', (req, res) => {
    packageController.registerPackage(req, res);
});

/**
 * GET /api/packages/say-hello
 * Endpoint de prueba
 */
router.get('/say-hello', (req, res) => {
    res.status(200).json({ message: 'Hello world' });
});

module.exports = router;
module.exports.setPackageController = setPackageController;