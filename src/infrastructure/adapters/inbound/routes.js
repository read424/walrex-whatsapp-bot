const { RegistryPackageService } = require('../../../domain/service');
const { MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const structuredLogger = require('../../config/StructuredLogger');
const cacheManager = require('../../config/CacheManager');

const fs = require('fs');
const router = express.Router();

const packageService = new RegistryPackageService();

// Middleware para logging de requests
router.use((req, res, next) => {
    structuredLogger.info('API_ROUTES', 'API request', {
        method: req.method,
        path: req.path,
        correlationId: req.correlationId
    });
    next();
});

router.post('/registry-package-name', async(req, res)=>{
    const { package, title, message } = req.body;
    try{
        structuredLogger.info('API_ROUTES', 'Registry package request', {
            package,
            title,
            correlationId: req.correlationId
        });
        const result = await packageService.registryPackage({ packageName: package, title, message });
        res.status(200).json(result);
    }catch(error){
        structuredLogger.error('API_ROUTES', 'Registry package error', error, {
            package,
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to send message' });
    }
});

router.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    if(!number || !message){
        return res.status(400).json({ error: 'Number and message are required' });
    }
    try{
        const whatsappContext = req.whatsappContext;
        await whatsappContext.sendButtons(number, message, undefined, 'Footer message');
        res.status(200).json({ success: true, message: 'Message sent successfully' });
    }catch(error){
        structuredLogger.error('API_ROUTES', 'Send message error', error, {
            number,
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to send message' });
    }
});

router.post('/send-message-media', async (req, res) => {
    const { numberphone, pathimg } = req.body;
    if(!numberphone || !pathimg){
        return res.status(400).json({ error: 'Number and mediaUrl are required' });
    }
    try{
        const whatsappContext = req.whatsappContext;
        if (fs.existsSync(pathimg)) {
            const media = MessageMedia.fromFilePath(pathimg);
            await whatsappContext.sendMessage(numberphone, media);
        }
        res.status(200).json({ success: true, message: 'Message sent successfully' });
    }catch(error){
        structuredLogger.error('API_ROUTES', 'Send media message error', error, {
            numberphone,
            pathimg,
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to send message' });
    }
});

router.post('/poll', async (req, res)=> {
    const { number, message } = req.body;
    structuredLogger.info('API_ROUTES', 'Poll request', {
        number,
        message: message?.name,
        correlationId: req.correlationId
    });
    if(!number || !message){
        return res.status(400).json({ error: 'Number and message are required' });
    }
    try{
        const whatsappContext = req.whatsappContext;
        await whatsappContext.sendMessage(number, message.name);
        res.status(200).json({ success: true, message: 'Message sent successfully' });
    }catch(error){
        structuredLogger.error('API_ROUTES', 'Poll error', error, {
            number,
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to send message' });
    }
});

router.get('/say-hello', async(req, res)=>{
    structuredLogger.info('API_ROUTES', 'Hello request', {
        correlationId: req.correlationId
    });
    res.status(200).json('Hello world' );
});

// Endpoints de monitoreo
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

// Endpoint para obtener el QR code
router.get('/qr', (req, res) => {
    try {
        // Obtener el QR del WebSocket adapter si está disponible
        const whatsappContext = req.whatsappContext;
        if (whatsappContext && whatsappContext.getQRCode) {
            const qrCode = whatsappContext.getQRCode();
            if (qrCode) {
                res.json({
                    success: true,
                    qr: qrCode,
                    message: 'Escanea este QR con tu WhatsApp'
                });
            } else {
                res.json({
                    success: false,
                    message: 'QR no disponible. Espera unos segundos y recarga la página.'
                });
            }
        } else {
            res.json({
                success: false,
                message: 'WhatsApp no está inicializado'
            });
        }
    } catch (error) {
        structuredLogger.error('API_ROUTES', 'Error getting QR code', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({
            success: false,
            message: 'Error al obtener el QR'
        });
    }
});

// Endpoint para obtener el estado del cliente WhatsApp
router.get('/status', (req, res) => {
    try {
        const whatsappContext = req.whatsappContext;
        if (whatsappContext && whatsappContext.getClientStatus) {
            const status = whatsappContext.getClientStatus();
            res.json({
                success: true,
                status: status,
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                success: false,
                message: 'WhatsApp no está inicializado'
            });
        }
    } catch (error) {
        structuredLogger.error('API_ROUTES', 'Error getting client status', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({
            success: false,
            message: 'Error al obtener el estado'
        });
    }
});

// Endpoint para controlar el indicador de escritura
router.post('/typing', (req, res) => {
    try {
        const { phoneNumber, action, duration } = req.body;
        const whatsappContext = req.whatsappContext;
        
        if (!whatsappContext || !whatsappContext.strategy) {
            return res.status(400).json({
                success: false,
                message: 'WhatsApp no está inicializado'
            });
        }

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'phoneNumber es requerido'
            });
        }

        if (action === 'start') {
            // Iniciar indicador de escritura
            whatsappContext.strategy.client.sendStateTyping(phoneNumber);
            structuredLogger.info('API_ROUTES', 'Typing indicator started', {
                phoneNumber,
                duration,
                correlationId: req.correlationId
            });
        } else if (action === 'stop') {
            // Detener indicador de escritura
            whatsappContext.strategy.client.sendStateTyping(phoneNumber, false);
            structuredLogger.info('API_ROUTES', 'Typing indicator stopped', {
                phoneNumber,
                correlationId: req.correlationId
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'action debe ser "start" o "stop"'
            });
        }

        res.json({
            success: true,
            message: `Typing indicator ${action}ed for ${phoneNumber}`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        structuredLogger.error('API_ROUTES', 'Error controlling typing indicator', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({
            success: false,
            message: 'Error al controlar el indicador de escritura'
        });
    }
});

module.exports = router;