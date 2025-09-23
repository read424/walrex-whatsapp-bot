const express = require('express');
const { MessageMedia } = require('whatsapp-web.js');
const structuredLogger = require('../../../../../infrastructure/config/StructuredLogger');

const router = express.Router();

/**
 * Función de utilidad para crear un objeto MessageMedia de manera robusta
*/
function createMessageMedia(mimeType, base64Data, filename) {
    try {
        if (!mimeType || !base64Data) {
            throw new Error('mimeType and base64Data are required');
        }
        
        if (typeof base64Data !== 'string' || base64Data.length === 0) {
            throw new Error('base64Data must be a non-empty string');
        }
        
        try {
            Buffer.from(base64Data, 'base64');
        } catch (error) {
            throw new Error('Invalid base64 data');
        }
        
        const media = new MessageMedia(mimeType, base64Data, filename || 'file');
        
        if (!media || !media.mimetype || !media.data) {
            throw new Error('Failed to create valid MessageMedia object');
        }
        
        return media;
    } catch (error) {
        structuredLogger.error('WHATSAPP_ROUTES', 'Error creating MessageMedia', error, {
            mimeType,
            base64DataLength: base64Data?.length || 0,
            filename
        });
        throw error;
    }
}

/**
 * POST /api/whatsapp/connect
 * Crear nueva conexión de WhatsApp
 */
router.post('/connect', async (req, res) => {
    try {
        const { connectionId, connectionName, tenantId } = req.body;
        
        structuredLogger.info('WHATSAPP_ROUTES', 'Creating new WhatsApp connection', {
            connectionId,
            tenantId,
            connectionName,
            correlationId: req.correlationId
        });

        const result = await req.connectionManager.createNewConnection(connectionId, connectionName, tenantId);
        res.json(result);
    } catch (error) {
        structuredLogger.error('WHATSAPP_ROUTES', 'Error creating WhatsApp connection', error, {
            connectionName: req.body?.connectionName,
            connectionId: req.body?.connectionId,
            correlationId: req.correlationId
        });
        res.status(500).json({ error: error.message || 'Failed to create new connection' });
    }
});

/**
 * GET /api/whatsapp/tenants-info
 * Obtener información de tenants activos
 */
router.get('/tenants-info', async (req, res) => {
    try {
        const tenantsInfo = req.webSocketAdapter.getTenantsInfo();
        
        structuredLogger.info('WHATSAPP_ROUTES', 'Tenants info requested', {
            totalTenants: Object.keys(tenantsInfo).length,
            correlationId: req.correlationId
        });

        res.json({
            totalTenants: Object.keys(tenantsInfo).length,
            tenants: tenantsInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        structuredLogger.error('WHATSAPP_ROUTES', 'Error getting tenants info', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to get tenants information' });
    }
});

/**
 * POST /api/whatsapp/send-message
 * Enviar mensaje de texto
 */
router.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    if (!number || !message) {
        return res.status(400).json({ error: 'Number and message are required' });
    }
    try {
        const whatsappContext = req.whatsappContext;
        await whatsappContext.sendButtons(number, message, undefined, 'Footer message');
        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        structuredLogger.error('WHATSAPP_ROUTES', 'Send message error', error, {
            number,
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/**
 * POST /api/whatsapp/send-message-media
 * Enviar mensaje multimedia
 */
router.post('/send-message-media', async (req, res) => {
    const { numberphone, imageBuffer, mimeType, filename } = req.body;
    if (!numberphone || !imageBuffer) {
        return res.status(400).json({ error: 'Number and imageBuffer are required' });
    }
    try {
        structuredLogger.info('WHATSAPP_ROUTES', 'Processing media message request', {
            numberphone,
            mimeType,
            filename,
            bufferSize: imageBuffer?.length || 0,
            correlationId: req.correlationId
        });
        
        const whatsappContext = req.whatsappContext;
        if (!whatsappContext) {
            structuredLogger.error('WHATSAPP_ROUTES', 'WhatsApp context not available', {
                numberphone,
                correlationId: req.correlationId
            });
            return res.status(500).json({ error: 'WhatsApp context not available' });
        }
        
        if (typeof imageBuffer !== 'string' || imageBuffer.length === 0) {
            structuredLogger.error('WHATSAPP_ROUTES', 'Invalid imageBuffer provided', {
                numberphone,
                imageBufferType: typeof imageBuffer,
                imageBufferLength: imageBuffer?.length || 0,
                correlationId: req.correlationId
            });
            return res.status(400).json({ error: 'Invalid imageBuffer provided' });
        }
        
        let buffer;
        try {
            buffer = Buffer.from(imageBuffer, 'base64');
        } catch (bufferError) {
            structuredLogger.error('WHATSAPP_ROUTES', 'Failed to convert base64 to buffer', bufferError, {
                numberphone,
                imageBufferLength: imageBuffer.length,
                correlationId: req.correlationId
            });
            return res.status(400).json({ error: 'Invalid base64 image data' });
        }
        
        const maxSizeBytes = 16 * 1024 * 1024; // 16MB
        if (buffer.length > maxSizeBytes) {
            structuredLogger.error('WHATSAPP_ROUTES', 'File size too large', {
                numberphone,
                bufferSize: buffer.length,
                maxSizeBytes,
                correlationId: req.correlationId
            });
            return res.status(400).json({ error: 'File size too large. Maximum size is 16MB' });
        }
        
        let media;
        try {
            media = createMessageMedia(
                mimeType || 'image/jpeg',
                imageBuffer,
                filename || 'image.jpg'
            );
        } catch (mediaError) {
            structuredLogger.error('WHATSAPP_ROUTES', 'Error creating MessageMedia', mediaError, {
                numberphone,
                mimeType,
                bufferSize: buffer.length,
                correlationId: req.correlationId
            });
            throw new Error(`Failed to create MessageMedia: ${mediaError.message}`);
        }
        
        await whatsappContext.sendMessageMedia(numberphone, media);
        structuredLogger.info('WHATSAPP_ROUTES', 'Media message sent successfully', {
            numberphone,
            correlationId: req.correlationId
        });
        
        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        structuredLogger.error('WHATSAPP_ROUTES', 'Send media message error', error, {
            numberphone,
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/**
 * POST /api/whatsapp/poll
 * Enviar encuesta
 */
router.post('/poll', async (req, res) => {
    const { number, message } = req.body;
    structuredLogger.info('WHATSAPP_ROUTES', 'Poll request', {
        number,
        message: message?.name,
        correlationId: req.correlationId
    });
    if (!number || !message) {
        return res.status(400).json({ error: 'Number and message are required' });
    }
    try {
        const whatsappContext = req.whatsappContext;
        await whatsappContext.sendMessage(number, message.name);
        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        structuredLogger.error('WHATSAPP_ROUTES', 'Poll error', error, {
            number,
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/**
 * GET /api/whatsapp/status
 * Obtener estado del cliente WhatsApp
 */
router.get('/status', async (req, res) => {
    try {
        const whatsappContext = req.whatsappContext;
        if (!whatsappContext) {
            return res.status(500).json({ error: 'WhatsApp context not available' });
        }
        
        const status = whatsappContext.getClientStatus();
        structuredLogger.info('WHATSAPP_ROUTES', 'WhatsApp status request', {
            status,
            correlationId: req.correlationId
        });
        
        res.status(200).json({
            status,
            hasContext: !!whatsappContext,
            hasStrategy: !!whatsappContext.strategy
        });
    } catch (error) {
        structuredLogger.error('WHATSAPP_ROUTES', 'WhatsApp status error', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to get WhatsApp status' });
    }
});

/**
 * POST /api/whatsapp/reconnect
 * Forzar reconexión de WhatsApp
 */
router.post('/reconnect', async (req, res) => {
    try {
        const whatsappContext = req.whatsappContext;
        if (!whatsappContext) {
            return res.status(500).json({ error: 'WhatsApp context not available' });
        }

        structuredLogger.info('WHATSAPP_ROUTES', 'Manual WhatsApp reconnection requested', {
            correlationId: req.correlationId
        });

        await whatsappContext.reconnect();

        const status = whatsappContext.getClientStatus();
        structuredLogger.info('WHATSAPP_ROUTES', 'Manual WhatsApp reconnection completed', {
            status,
            correlationId: req.correlationId
        });

        res.status(200).json({
            message: 'Manual reconnection initiated',
            status,
            hasContext: !!whatsappContext
        });
    } catch (error) {
        structuredLogger.error('WHATSAPP_ROUTES', 'Error in manual WhatsApp reconnection', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to reconnect' });
    }
});

/**
 * GET /api/whatsapp/monitoring-status
 * Obtener información del monitoreo automático
 */
router.get('/monitoring-status', async (req, res) => {
    try {
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
        structuredLogger.error('WHATSAPP_ROUTES', 'Error getting monitoring status', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({ error: 'Failed to get monitoring status' });
    }
});

/**
 * GET /api/whatsapp/qr
 * Obtener código QR
 */
router.get('/qr', (req, res) => {
    try {
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
        structuredLogger.error('WHATSAPP_ROUTES', 'Error getting QR code', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({
            success: false,
            message: 'Error al obtener el QR'
        });
    }
});

/**
 * POST /api/whatsapp/typing
 * Controlar indicador de escritura
 */
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
            whatsappContext.strategy.client.sendStateTyping(phoneNumber);
            structuredLogger.info('WHATSAPP_ROUTES', 'Typing indicator started', {
                phoneNumber,
                duration,
                correlationId: req.correlationId
            });
        } else if (action === 'stop') {
            whatsappContext.strategy.client.sendStateTyping(phoneNumber, false);
            structuredLogger.info('WHATSAPP_ROUTES', 'Typing indicator stopped', {
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
        structuredLogger.error('WHATSAPP_ROUTES', 'Error controlling typing indicator', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({
            success: false,
            message: 'Error al controlar el indicador de escritura'
        });
    }
});

router.post('/restart-connection', async (req, res) => {
    try {
        const { clientId } = req.body;
        const tenantId = req.headers['X-Tenant-Id'] || 1;

        if(!clientId || !tenantId){
            return res.status(400).json({
                success: false,
                message: 'clientId y tenantId son requeridos'
            });
        }

        const result = await req.connectionManager.restartConnection(clientId, tenantId);
        res.json(result);
    }catch(error){
        structuredLogger.error('WHATSAPP_ROUTES', 'Error restaring connection', error);
        res.status(500).json({
            success: false,
            message: 'Error al reiniciar la conexión'
        });
    }
});

// Reset completo del dispositivo - desvincular, limpiar sesiones y preparar para nuevo emparejamiento
router.post('/reset-device', async (req, res) => {
    try {
        const { clientId, tenantId } = req.body;

        if (!clientId || !tenantId) {
            return res.status(400).json({
                success: false,
                message: 'clientId y tenantId son requeridos'
            });
        }

        const result = await req.connectionManager.resetDeviceConnection(clientId, tenantId);
        res.json(result);
    } catch (error) {
        structuredLogger.error('WHATSAPP_ROUTES', 'Error resetting device connection', error);
        res.status(500).json({
            success: false,
            message: 'Error al resetear la conexión del dispositivo'
        });
    }
});

// Endpoint para verificar el estado de los listeners (debug)
router.get('/listener-status/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;
        
        const connectionData = req.connectionManager.activeConnections.get(clientId);
        
        if (!connectionData) {
            return res.status(404).json({
                success: false,
                message: `Connection ${clientId} not found`
            });
        }

        const listenerStatus = connectionData.strategy.getListenerStatus();
        
        res.json({
            success: true,
            clientId: clientId,
            listenerStatus: listenerStatus
        });
    } catch (error) {
        structuredLogger.error('WHATSAPP_ROUTES', 'Error getting listener status', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el estado de los listeners'
        });
    }
});

module.exports = router;