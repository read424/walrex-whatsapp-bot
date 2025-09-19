const express = require('express');
const { RegistryPackageService } = require('../../../../../domain/service');
const structuredLogger = require('../../../../../infrastructure/config/StructuredLogger');

const router = express.Router();
const packageService = new RegistryPackageService();

/**
 * POST /api/packages/registry-name
 * Registrar nombre de paquete
 */
router.post('/registry-name', async (req, res) => {
    const { package, title, message } = req.body;
    try {
        structuredLogger.info('PACKAGES_ROUTES', 'Registry package request', {
            package,
            title,
            correlationId: req.correlationId
        });
        const result = await packageService.registryPackage({ packageName: package, title, message });
        res.status(200).json(result);
    } catch (error) {
        structuredLogger.error('PACKAGES_ROUTES', 'Registry package error', error, {
            package,
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/**
 * GET /api/packages/say-hello
 * Endpoint de prueba
 */
router.get('/say-hello', async (req, res) => {
    structuredLogger.info('PACKAGES_ROUTES', 'Hello request', {
        correlationId: req.correlationId
    });
    res.status(200).json('Hello world');
});

module.exports = router;