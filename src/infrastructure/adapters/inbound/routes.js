const express = require('express');
const restRoutes = require('./rest/routes');
const structuredLogger = require('../../config/StructuredLogger');
const cacheManager = require('../../config/CacheManager');

const router = express.Router();

// Middleware para logging de requests
router.use((req, res, next) => {
    structuredLogger.info('API_ROUTES', 'API request', {
        method: req.method,
        path: req.path,
        correlationId: req.correlationId
    });
    next();
});

// Integrar todas las rutas REST modulares
router.use('/', restRoutes);

// Endpoints de monitoreo y salud del sistema (mantener en el nivel principal)
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
    });
});

router.get('/cache/stats', (req, res) => {
    const stats = cacheManager.getStats();
    structuredLogger.metric('API_ROUTES', 'cache_stats', stats, {
        correlationId: req.correlationId
    });
    res.status(200).json(stats);
});

router.get('/cache/keys', (req, res) => {
    const keys = cacheManager.keys();
    res.status(200).json({
        keys,
        count: keys.length,
        correlationId: req.correlationId
    });
});

router.delete('/cache/clear', (req, res) => {
    cacheManager.clear();
    structuredLogger.info('API_ROUTES', 'Cache cleared', {
        correlationId: req.correlationId
    });
    res.status(200).json({
        message: 'Cache cleared successfully',
        correlationId: req.correlationId
    });
});

router.get('/logs/levels', (req, res) => {
    res.status(200).json({
        currentLevel: process.env.LOG_LEVEL || 'info',
        availableLevels: ['error', 'warn', 'info', 'debug'],
        correlationId: req.correlationId
    });
});

module.exports = router;