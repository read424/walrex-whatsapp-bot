const express = require('express');
const router = express.Router();
const extractTenantId = require('../../middleware/tenantMiddleware');

/**
 * Rutas v2 para gestión de conexiones de canales unificadas
 * Base path: /api/v2/connections
 *
 * Todos los endpoints requieren:
 * - Header: Authorization: Bearer {token}
 * - Header: X-Tenant-Id: {tenantId}
 */

module.exports = (channelConnectionController) => {
    if (!channelConnectionController) {
        throw new Error('channelConnectionController is required');
    }

    // Aplicar middleware de tenant a todas las rutas
    router.use(extractTenantId);

    /**
     * POST /api/v2/connections
     * Crear una nueva conexión de canal
     *
     * Body para WhatsApp Web:
     * {
     *   "connectionName": "WhatsApp Ventas Principal",
     *   "channelType": "whatsapp_web",
     *   "departmentId": 1,
     *   "welcomeMessage": "¡Hola! Bienvenido a nuestro servicio",
     *   "goodbyeMessage": "Gracias por contactarnos",
     *   "chatbotTimeout": 30
     * }
     *
     * Body para Instagram/Facebook:
     * {
     *   "connectionName": "Instagram Soporte",
     *   "channelType": "instagram_direct",
     *   "departmentId": 2,
     *   "welcomeMessage": "¡Hola! ¿En qué podemos ayudarte?",
     *   "goodbyeMessage": "¡Hasta pronto!",
     *   "chatbotTimeout": 30,
     *   "channelCredentials": {
     *     "accessToken": "EAAD...",
     *     "verifyToken": "mi_token_secreto_123",
     *     "pageId": "123456789",
     *     "instagramAccountId": "17841234567890"
     *   }
     * }
     */
    router.post('/',
        // TODO: Agregar middleware de autenticación
        // authenticate,
        (req, res) => channelConnectionController.createConnection(req, res)
    );

    /**
     * GET /api/v2/connections
     * Listar todas las conexiones del tenant
     *
     * Query params:
     * - channelType: Filtrar por tipo de canal
     * - status: Filtrar por estado
     * - isActive: Filtrar por activo/inactivo
     */
    router.get('/',
        // TODO: Agregar middleware de autenticación
        // authenticate,
        (req, res) => channelConnectionController.listConnections(req, res)
    );

    /**
     * GET /api/v2/connections/:id
     * Obtener detalles de una conexión específica
     */
    router.get('/:id',
        // TODO: Agregar middleware de autenticación
        // authenticate,
        (req, res) => channelConnectionController.getConnection(req, res)
    );

    /**
     * GET /api/v2/connections/:id/qr
     * Obtener código QR para WhatsApp Web
     * Solo válido para conexiones de tipo whatsapp_web
     */
    router.get('/:id/qr',
        // TODO: Agregar middleware de autenticación
        // authenticate,
        (req, res) => channelConnectionController.getWhatsAppQR(req, res)
    );

    /**
     * PUT /api/v2/connections/:id
     * Actualizar una conexión existente
     */
    router.put('/:id',
        // TODO: Agregar middleware de autenticación
        // authenticate,
        (req, res) => {
            res.status(501).json({
                success: false,
                message: 'Update connection endpoint not implemented yet'
            });
        }
    );

    /**
     * DELETE /api/v2/connections/:id
     * Eliminar (desactivar) una conexión
     */
    router.delete('/:id',
        // TODO: Agregar middleware de autenticación
        // authenticate,
        (req, res) => {
            res.status(501).json({
                success: false,
                message: 'Delete connection endpoint not implemented yet'
            });
        }
    );

    /**
     * POST /api/v2/connections/:id/activate
     * Activar una conexión
     */
    router.post('/:id/activate',
        // TODO: Agregar middleware de autenticación
        // authenticate,
        (req, res) => {
            res.status(501).json({
                success: false,
                message: 'Activate connection endpoint not implemented yet'
            });
        }
    );

    /**
     * POST /api/v2/connections/:id/deactivate
     * Desactivar una conexión
     */
    router.post('/:id/deactivate',
        // TODO: Agregar middleware de autenticación
        // authenticate,
        (req, res) => {
            res.status(501).json({
                success: false,
                message: 'Deactivate connection endpoint not implemented yet'
            });
        }
    );

    /**
     * POST /api/v2/connections/:id/test
     * Probar la conexión (enviar mensaje de prueba)
     */
    router.post('/:id/test',
        // TODO: Agregar middleware de autenticación
        // authenticate,
        (req, res) => {
            res.status(501).json({
                success: false,
                message: 'Test connection endpoint not implemented yet'
            });
        }
    );

    /**
     * GET /api/v2/connections/:id/stats
     * Obtener estadísticas de la conexión
     */
    router.get('/:id/stats',
        // TODO: Agregar middleware de autenticación
        // authenticate,
        (req, res) => {
            res.status(501).json({
                success: false,
                message: 'Connection stats endpoint not implemented yet'
            });
        }
    );

    return router;
};