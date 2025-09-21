const express = require('express');
const ChatService = require('../../../../../domain/service/ChatService');
const { WhatsAppConnection } = require('../../../../../models');
const structuredLogger = require('../../../../../infrastructure/config/StructuredLogger');

const router = express.Router();

/**
 * GET /api/chat/sessions
 * Obtener sesiones de chat activas
 */
router.get('/sessions', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || '1';
        const { status, limit = 50, offset = 0 } = req.query;

        const chatService = new ChatService(req.webSocketAdapter);
        const sessions = await chatService.getChatSessions(tenantId, {
            status,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: sessions,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: sessions.length
            }
        });

    } catch (error) {
        structuredLogger.error('CHAT_ROUTES', 'Error fetching chat sessions', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener sesiones de chat'
        });
    }
});

/**
 * GET /api/chat/sessions/:sessionId/messages
 * Obtener mensajes de una sesión específica
 */
router.get('/sessions/:sessionId/messages', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const chatService = new ChatService(req.webSocketAdapter);
        const messages = await chatService.getChatMessages(
            sessionId,
            parseInt(limit),
            parseInt(offset)
        );

        res.json({
            success: true,
            data: messages,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: messages.length
            }
        });

    } catch (error) {
        structuredLogger.error('CHAT_ROUTES', 'Error fetching chat messages', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener mensajes del chat'
        });
    }
});

/**
 * POST /api/chat/sessions/:sessionId/messages
 * Enviar mensaje en una sesión de chat
 */
router.post('/sessions/:sessionId/messages', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { content, messageType = 'text' } = req.body;
        const advisorId = req.user?.id; // Asumiendo que tienes middleware de auth

        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'El contenido del mensaje es requerido'
            });
        }

        const chatService = new ChatService(req.webSocketAdapter);
        
        // 1. Obtener información de la sesión
        const ChatSession = require('../models/Chat').ChatSession;
        const chatSession = await ChatSession.findByPk(sessionId, {
            include: [
                { 
                    model: require('../models/Chat').Contact, 
                    as: 'contact' 
                }
            ]
        });

        if (!chatSession) {
            return res.status(404).json({
                success: false,
                message: 'Sesión de chat no encontrada'
            });
        }

        // 2. Obtener conexión de WhatsApp
        const connection = await WhatsAppConnection.findByPk(chatSession.connectionId);
        if (!connection) {
            return res.status(404).json({
                success: false,
                message: 'Conexión de WhatsApp no encontrada'
            });
        }

        // 3. Buscar la estrategia activa (esto dependerá de tu implementación)
        const connectionManager = req.connectionManager;
        const activeConnection = connectionManager.getConnection(connection.clientId);
        
        if (!activeConnection || !activeConnection.strategy) {
            return res.status(503).json({
                success: false,
                message: 'Conexión de WhatsApp no disponible'
            });
        }

        // 4. Enviar mensaje y actualizar BD
        const phoneNumber = chatSession.contact.phoneNumber + '@c.us';
        const message = await activeConnection.strategy.sendMessageAndUpdate(
            phoneNumber,
            content,
            messageType,
            advisorId
        );

        res.json({
            success: true,
            data: message,
            message: 'Mensaje enviado correctamente'
        });

    } catch (error) {
        structuredLogger.error('CHAT_ROUTES', 'Error sending chat message', error);
        res.status(500).json({
            success: false,
            message: 'Error al enviar mensaje'
        });
    }
});

/**
 * PATCH /api/chat/sessions/:sessionId
 * Actualizar sesión de chat (estado, asignación, etc.)
 */
router.patch('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { status, handledBy, metadata } = req.body;

        const ChatSession = require('../models/Chat').ChatSession;
        const chatSession = await ChatSession.findByPk(sessionId);

        if (!chatSession) {
            return res.status(404).json({
                success: false,
                message: 'Sesión de chat no encontrada'
            });
        }

        // Actualizar campos permitidos
        const updateData = {};
        if (status) updateData.status = status;
        if (handledBy !== undefined) updateData.handledBy = handledBy;
        if (metadata) updateData.metadata = { ...chatSession.metadata, ...metadata };

        await chatSession.update(updateData);

        // Emitir actualización por WebSocket
        req.webSocketAdapter.emitToTenant(chatSession.tenantId, 'sessionUpdated', {
            sessionId,
            updates: updateData
        });

        res.json({
            success: true,
            data: chatSession,
            message: 'Sesión actualizada correctamente'
        });

    } catch (error) {
        structuredLogger.error('CHAT_ROUTES', 'Error updating chat session', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar sesión'
        });
    }
});

/**
 * GET /api/chat/contacts
 * Obtener contactos
 */
router.get('/contacts', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || '1';
        const { search, limit = 50, offset = 0 } = req.query;

        const Contact = require('../models/Chat').Contact;
        const where = { tenantId };

        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { phoneNumber: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const contacts = await Contact.findAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['updatedAt', 'DESC']]
        });

        res.json({
            success: true,
            data: contacts
        });

    } catch (error) {
        structuredLogger.error('CHAT_ROUTES', 'Error fetching contacts', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener contactos'
        });
    }
});

/**
 * POST /api/chat/contacts
 * Crear nuevo contacto
 */
router.post('/contacts', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || '1';
        const { phoneNumber, name, metadata } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'El número de teléfono es requerido'
            });
        }

        const Contact = require('../models/Chat').Contact;
        const contact = await Contact.create({
            phoneNumber,
            name,
            tenantId,
            metadata: metadata || {}
        });

        res.json({
            success: true,
            data: contact,
            message: 'Contacto creado correctamente'
        });

    } catch (error) {
        structuredLogger.error('CHAT_ROUTES', 'Error creating contact', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear contacto'
        });
    }
});

module.exports = router;