const { RegistryPackageService, TradingService } = require('../../../domain/service');
const { CalculateTradeExchangeUseCase } = require('../../../application/usecases');
const { TradingPort } = require('../../../application/ports/output');
const { MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const structuredLogger = require('../../config/StructuredLogger');
const cacheManager = require('../../config/CacheManager');

const fs = require('fs');
const router = express.Router();

const packageService = new RegistryPackageService();

// TODO: Inicializar el adaptador de trading cuando se implemente
// const tradingAdapter = new TradingAdapter();
// const tradingService = new TradingService(tradingAdapter);
// const calculateTradeExchangeUseCase = new CalculateTradeExchangeUseCase(tradingService);

/**
 * Función de utilidad para crear un objeto MessageMedia de manera robusta
 * @param {string} mimeType - Tipo MIME del archivo
 * @param {string} base64Data - Datos en base64
 * @param {string} filename - Nombre del archivo
 * @returns {MessageMedia} Objeto MessageMedia
 */
function createMessageMedia(mimeType, base64Data, filename) {
    try {
        // Validar parámetros
        if (!mimeType || !base64Data) {
            throw new Error('mimeType and base64Data are required');
        }
        
        // Validar que base64Data sea una cadena válida
        if (typeof base64Data !== 'string' || base64Data.length === 0) {
            throw new Error('base64Data must be a non-empty string');
        }
        
        // Validar que el base64 sea válido
        try {
            Buffer.from(base64Data, 'base64');
        } catch (error) {
            throw new Error('Invalid base64 data');
        }
        
        // Crear el MessageMedia
        const media = new MessageMedia(
            mimeType,
            base64Data,
            filename || 'file'
        );
        
        // Validar que el objeto se creó correctamente
        if (!media || !media.mimetype || !media.data) {
            throw new Error('Failed to create valid MessageMedia object');
        }
        
        return media;
    } catch (error) {
        structuredLogger.error('API_ROUTES', 'Error creating MessageMedia', error, {
            mimeType,
            base64DataLength: base64Data?.length || 0,
            filename
        });
        throw error;
    }
}

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
    const { numberphone, imageBuffer, mimeType, filename } = req.body;
    if(!numberphone || !imageBuffer){
        return res.status(400).json({ error: 'Number and imageBuffer are required' });
    }
    try{
        structuredLogger.info('API_ROUTES', 'Processing media message request', {
            numberphone,
            mimeType,
            filename,
            bufferSize: imageBuffer?.length || 0,
            correlationId: req.correlationId
        });
        
        const whatsappContext = req.whatsappContext;
        if (!whatsappContext) {
            structuredLogger.error('API_ROUTES', 'WhatsApp context not available', {
                numberphone,
                correlationId: req.correlationId
            });
            return res.status(500).json({ error: 'WhatsApp context not available' });
        }
        
        // Validar que imageBuffer sea una cadena base64 válida
        if (typeof imageBuffer !== 'string' || imageBuffer.length === 0) {
            structuredLogger.error('API_ROUTES', 'Invalid imageBuffer provided', {
                numberphone,
                imageBufferType: typeof imageBuffer,
                imageBufferLength: imageBuffer?.length || 0,
                correlationId: req.correlationId
            });
            return res.status(400).json({ error: 'Invalid imageBuffer provided' });
        }
        
        // Convertir el buffer base64 a Buffer
        let buffer;
        try {
            buffer = Buffer.from(imageBuffer, 'base64');
        } catch (bufferError) {
            structuredLogger.error('API_ROUTES', 'Failed to convert base64 to buffer', bufferError, {
                numberphone,
                imageBufferLength: imageBuffer.length,
                correlationId: req.correlationId
            });
            return res.status(400).json({ error: 'Invalid base64 image data' });
        }
        
        structuredLogger.info('API_ROUTES', 'Buffer converted successfully', {
            numberphone,
            bufferSize: buffer.length,
            correlationId: req.correlationId
        });
        
        // Validar tamaño del archivo (WhatsApp tiene un límite de ~16MB)
        const maxSizeBytes = 16 * 1024 * 1024; // 16MB
        if (buffer.length > maxSizeBytes) {
            structuredLogger.error('API_ROUTES', 'File size too large', {
                numberphone,
                bufferSize: buffer.length,
                maxSizeBytes,
                correlationId: req.correlationId
            });
            return res.status(400).json({ error: 'File size too large. Maximum size is 16MB' });
        }
        
        // Crear MessageMedia usando la función de utilidad
        let media;
        try {
            media = createMessageMedia(
                mimeType || 'image/jpeg',
                imageBuffer,
                filename || 'image.jpg'
            );
        } catch (mediaError) {
            structuredLogger.error('API_ROUTES', 'Error creating MessageMedia', mediaError, {
                numberphone,
                mimeType,
                bufferSize: buffer.length,
                correlationId: req.correlationId
            });
            throw new Error(`Failed to create MessageMedia: ${mediaError.message}`);
        }
        
        structuredLogger.info('API_ROUTES', 'MessageMedia created successfully', {
            numberphone,
            mediaType: media.mimetype,
            mediaSize: media.data.length,
            correlationId: req.correlationId
        });
        
        structuredLogger.info('API_ROUTES', 'About to send media message', {
            numberphone,
            mediaType: media.mimetype,
            mediaSize: media.data.length,
            correlationId: req.correlationId
        });
        
        await whatsappContext.sendMessageMedia(numberphone, media);
        structuredLogger.info('API_ROUTES', 'Media message sent successfully', {
            numberphone,
            correlationId: req.correlationId
        });
        
        res.status(200).json({ success: true, message: 'Message sent successfully' });
    }catch(error){
        structuredLogger.error('API_ROUTES', 'Send media message error', error, {
            numberphone,
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

router.get('/whatsapp-status', async(req, res)=>{
    try {
        const whatsappContext = req.whatsappContext;
        if (!whatsappContext) {
            return res.status(500).json({ error: 'WhatsApp context not available' });
        }
        
        const status = whatsappContext.getClientStatus();
        structuredLogger.info('API_ROUTES', 'WhatsApp status request', {
            status,
            correlationId: req.correlationId
        });
        
        res.status(200).json({
            status,
            hasContext: !!whatsappContext,
            hasStrategy: !!whatsappContext.strategy
        });
    } catch (error) {
        structuredLogger.error('API_ROUTES', 'WhatsApp status error', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to get WhatsApp status' });
    }
});

router.post('/whatsapp-reconnect', async(req, res)=>{
    try {
        const whatsappContext = req.whatsappContext;
        if (!whatsappContext) {
            return res.status(500).json({ error: 'WhatsApp context not available' });
        }

        structuredLogger.info('API_ROUTES', 'Manual WhatsApp reconnection requested', {
            correlationId: req.correlationId
        });

        // Forzar reconexión
        await whatsappContext.reconnect();

        const status = whatsappContext.getClientStatus();
        structuredLogger.info('API_ROUTES', 'Manual WhatsApp reconnection completed', {
            status,
            correlationId: req.correlationId
        });

        res.status(200).json({
            message: 'Manual reconnection initiated',
            status,
            hasContext: !!whatsappContext
        });
    } catch (error) {
        structuredLogger.error('API_ROUTES', 'Error in manual WhatsApp reconnection', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to reconnect' });
    }
});

// Endpoint para obtener información del monitoreo automático
router.get('/whatsapp-monitoring-status', async(req, res)=>{
    try {
        // Esta información debería estar disponible globalmente en app.js
        // Por ahora retornamos información básica
        res.status(200).json({
            message: 'WhatsApp monitoring status',
            monitoring: {
                enabled: true,
                description: 'El servidor monitorea automáticamente el estado de WhatsApp cada 30 segundos',
                autoReconnect: true,
                maxFailures: 3,
                monitoringInterval: '30 segundos',
                reconnectCooldown: '1 minuto'
            },
            instructions: [
                'El servidor detecta automáticamente cuando WhatsApp no está autenticado',
                'Después de 3 fallos consecutivos, intenta reconectar automáticamente',
                'Genera un nuevo código QR cuando es necesario',
                'Notifica por WebSocket cuando hay cambios de estado'
            ]
        });
    } catch (error) {
        structuredLogger.error('API_ROUTES', 'Error getting monitoring status', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to get monitoring status' });
    }
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

/**
 * Endpoint para calcular el tipo de cambio de trading
 * GET /calculate-trade-exchange
 * Body: { currency_base, currency_quote, amount }
 */
router.get('/calculate-trade-exchange', async (req, res) => {
    try {
        const { currency_base, currency_quote, amount } = req.body;
        
        structuredLogger.info('API_ROUTES', 'Calculate trade exchange request', {
            currency_base,
            currency_quote,
            amount,
            correlationId: req.correlationId
        });
        
        // Validar parámetros requeridos
        if (!currency_base || !currency_quote || !amount) {
            return res.status(400).json({
                success: false,
                message: 'currency_base, currency_quote y amount son requeridos'
            });
        }
        
        // Validar que las monedas sean códigos ISO 4217 válidos (3 caracteres)
        const iso4217Regex = /^[A-Z]{3}$/;
        if (!iso4217Regex.test(currency_base)) {
            return res.status(400).json({
                success: false,
                message: 'currency_base debe ser un código ISO 4217 válido (3 caracteres)'
            });
        }
        
        if (!iso4217Regex.test(currency_quote)) {
            return res.status(400).json({
                success: false,
                message: 'currency_quote debe ser un código ISO 4217 válido (3 caracteres)'
            });
        }
        
        // Validar que amount sea un número decimal válido
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({
                success: false,
                message: 'amount debe ser un número decimal válido mayor a 0'
            });
        }
        
        // TODO: Implementar con el caso de uso cuando se complete el adaptador
        // const result = await calculateTradeExchangeUseCase.execute({
        //     currencyBase: currency_base,
        //     currencyQuote: currency_quote,
        //     amount: amountNum
        // });
        
        // Por ahora retornamos una respuesta de ejemplo
        const mockExchangeRate = 1.25; // Tipo de cambio de ejemplo
        const calculatedAmount = amountNum * mockExchangeRate;
        
        const response = {
            success: true,
            data: {
                currency_base,
                currency_quote,
                original_amount: amountNum,
                exchange_rate: mockExchangeRate,
                calculated_amount: calculatedAmount,
                timestamp: new Date().toISOString()
            }
        };
        
        structuredLogger.info('API_ROUTES', 'Calculate trade exchange successful', {
            currency_base,
            currency_quote,
            amount: amountNum,
            exchange_rate: mockExchangeRate,
            calculated_amount: calculatedAmount,
            correlationId: req.correlationId
        });
        
        res.status(200).json(response);
        
    } catch (error) {
        structuredLogger.error('API_ROUTES', 'Calculate trade exchange error', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({
            success: false,
            message: 'Error al calcular el tipo de cambio'
        });
    }
});

/**
 * POST /create-exchange-trading
 * Body: { currency_base, currency_quote, amount, asset }
 */
router.post('/create-exchange-trading', async (req, res) => {
    const { currency_base, currency_quote, amount, asset } = req.body || {};
    try {
        structuredLogger.info('API_ROUTES', 'Create exchange trading request', {
            currency_base, currency_quote, amount, asset, correlationId: req.correlationId
        });

        // Validaciones básicas
        const iso = /^[A-Z]{3}$/;
        if (!iso.test(currency_base) || !iso.test(currency_quote)) {
            return res.status(400).json({ success: false, message: 'currency_base y currency_quote deben ser ISO 4217' });
        }
        const parsedAmount = Number(amount);
        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'amount debe ser decimal > 0' });
        }
        if (!asset || typeof asset !== 'string') {
            return res.status(400).json({ success: false, message: 'asset es requerido' });
        }

// Composition root (simple) para inyección de dependencias
const { TradingAdapter, ExchangeRateRepositoryAdapter } = require('../outbound');
const BankTradeRepositoryAdapter = require('../outbound/BankTradeRepositoryAdapter');
const BinanceAPIAdapter = require('../outbound/BinanceAPIAdapter');
const { TradingService } = require('../../../domain/service');
const { CreateExchangeTradingUseCase } = require('../../../application/usecases');

function buildCreateExchangeTradingUseCase() {
    const exchangeRateRepository = new ExchangeRateRepositoryAdapter();
    const binanceApi = new BinanceAPIAdapter();
    const tradingAdapter = new TradingAdapter(exchangeRateRepository, binanceApi);
    const tradingService = new TradingService(tradingAdapter);
    const bankTradeRepo = new BankTradeRepositoryAdapter();
    return new CreateExchangeTradingUseCase(tradingService, bankTradeRepo);
}

        const useCase = buildCreateExchangeTradingUseCase();
        const result = await useCase.execute({
            currencyBase: currency_base,
            currencyQuote: currency_quote,
            amount: parsedAmount,
            asset
        });
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        structuredLogger.error('API_ROUTES', 'Create exchange trading error', error, { correlationId: req.correlationId });
        return res.status(500).json({ success: false, message: error.message || 'Error interno' });
    }
});

module.exports = router;