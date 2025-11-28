const express = require('express');
const router = express.Router();

/**
 * Rutas REST para Trading
 *
 * Este archivo SOLO define rutas y las mapea al controlador.
 * NO contiene lógica de negocio, validaciones ni manejo de errores.
 *
 * El controlador se inyecta a través de setTradingController()
 */

let tradingController = null;

/**
 * Inyecta el controlador (llamado desde el composition root)
 */
function setTradingController(controller) {
    tradingController = controller;
}

/**
 * Middleware para verificar que el controlador esté inyectado
 */
function ensureControllerInjected(req, res, next) {
    if (!tradingController) {
        return res.status(500).json({
            success: false,
            error: {
                message: 'TradingController no ha sido inyectado',
                code: 'CONTROLLER_NOT_INITIALIZED'
            }
        });
    }
    next();
}

// Aplicar middleware a todas las rutas
router.use(ensureControllerInjected);

/**
 * GET /api/trading/calculate-exchange
 * Calcular tipo de cambio
 */
router.get('/calculate-exchange', (req, res) => {
    tradingController.calculateExchange(req, res);
});

/**
 * POST /api/trading/create-exchange
 * Crear intercambio de trading
 */
router.post('/create-exchange', (req, res) => {
    tradingController.createExchange(req, res);
});

module.exports = router;
module.exports.setTradingController = setTradingController;