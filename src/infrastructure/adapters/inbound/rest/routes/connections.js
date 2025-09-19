const express = require('express');
const router = express.Router();
const { Connection, WhatsAppConnection } = require('../../../../../models');
const structuredLogger = require('../../../../../infrastructure/config/StructuredLogger');

/**
 * CREATE - Crear nueva conexión
 * POST /api/connections
*/
router.post('/', async (req, res) => {
    try {
        const { name, greetingMessage, farewellMessage, department, botResetMinutes } = req.body;
        
        // Validaciones
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la conexión es requerido'
            });
        }

        if (!department) {
            return res.status(400).json({
                success: false,
                message: 'El departamento es requerido'
            });
        }

        // Obtener tenantId del contexto (ajustar según tu implementación)
        const tenantId = req.tenantId || req.headers['x-tenant-id'] || 'tenant_001';

        // Verificar si ya existe una conexión con el mismo nombre para el tenant
        const existingConnection = await Connection.findOne({
            where: {
                connection_name: name.trim(),
                tenant_id: tenantId
            }
        });

        if (existingConnection) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una conexión con este nombre'
            });
        }

        // Crear nueva conexión
        const newConnection = await Connection.create({
            connection_name: name.trim(),
            provider_type: 'whatsapp', // Por defecto, ajustar si viene del form
            department: department,
            welcome_message: greetingMessage || null,
            goodbye_message: farewellMessage || null,
            chatbot_timeout: botResetMinutes || 30,
            tenant_id: tenantId,
            status: 'inactive'
        });

        structuredLogger.info('CONNECTIONS_API', 'New connection created', {
            connectionId: newConnection.id,
            connectionName: newConnection.connection_name,
            tenantId: tenantId,
            correlationId: req.correlationId
        });

        res.status(201).json({
            success: true,
            message: 'Conexión creada exitosamente',
            data: {
                id: newConnection.id,
                name: newConnection.connection_name,
                department: newConnection.department,
                status: newConnection.status,
                providerType: newConnection.provider_type,
                createdAt: newConnection.created_at
            }
        });

    } catch (error) {
        structuredLogger.error('CONNECTIONS_API', 'Error creating connection', error, {
            correlationId: req.correlationId
        });
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * READ - Obtener todas las conexiones
 * GET /api/connections
*/
router.get('/', async (req, res) => {
    try {
        const tenantId = req.tenantId || req.headers['x-tenant-id'] || 1;
        const { provider, status } = req.query;

        // Construir filtros
        const where = { tenant_id: tenantId };
        
        if (provider) {
            where.provider_type = provider;
        }
        
        if (status) {
            where.status = status;
        }

        const connections = await Connection.findAll({
            where,
            order: [['created_at', 'DESC']],
            attributes: [
                'id',
                'connection_name',
                'provider_type',
                'department',
                'status',
                'chatbot_timeout',
                'is_active',
                'created_at',
                'updated_at'
            ]
        });

        structuredLogger.info('CONNECTIONS_API', 'Connections retrieved', {
            count: connections.length,
            tenantId: tenantId,
            correlationId: req.correlationId
        });

        res.json({
            success: true,
            data: connections.map(conn => ({
                id: conn.id,
                name: conn.connection_name,
                providerType: conn.provider_type,
                department: conn.department,
                status: conn.status,
                botResetMinutes: conn.chatbot_timeout,
                isActive: conn.is_active,
                createdAt: conn.created_at,
                updatedAt: conn.updated_at
            })),
            total: connections.length
        });

    } catch (error) {
        structuredLogger.error('CONNECTIONS_API', 'Error retrieving connections', error, {
            correlationId: req.correlationId
        });
        
        res.status(500).json({
            success: false,
            message: 'Error al obtener las conexiones'
        });
    }
});

/**
 * READ - Obtener conexión por ID
 * GET /api/connections/:id
*/
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId || req.headers['x-tenant-id'] || 'tenant_001';

        const connection = await Connection.findOne({
            where: {
                id: id,
                tenant_id: tenantId
            }
        });

        if (!connection) {
            return res.status(404).json({
                success: false,
                message: 'Conexión no encontrada'
            });
        }

        structuredLogger.info('CONNECTIONS_API', 'Connection retrieved by ID', {
            connectionId: id,
            correlationId: req.correlationId
        });

        res.json({
            success: true,
            data: {
                id: connection.id,
                name: connection.connection_name,
                providerType: connection.provider_type,
                department: connection.department,
                greetingMessage: connection.welcome_message,
                farewellMessage: connection.goodbye_message,
                botResetMinutes: connection.chatbot_timeout,
                status: connection.status,
                isActive: connection.is_active,
                createdAt: connection.created_at,
                updatedAt: connection.updated_at
            }
        });

    } catch (error) {
        structuredLogger.error('CONNECTIONS_API', 'Error retrieving connection by ID', error, {
            connectionId: req.params.id,
            correlationId: req.correlationId
        });
        
        res.status(500).json({
            success: false,
            message: 'Error al obtener la conexión'
        });
    }
});

/**
 * UPDATE - Actualizar conexión
 * PUT /api/connections/:id
*/
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, greetingMessage, farewellMessage, department, botResetMinutes } = req.body;
        const tenantId = req.tenantId || req.headers['x-tenant-id'] || 'tenant_001';

        // Buscar conexión existente
        const connection = await Connection.findOne({
            where: {
                id: id,
                tenant_id: tenantId
            }
        });

        if (!connection) {
            return res.status(404).json({
                success: false,
                message: 'Conexión no encontrada'
            });
        }

        // Validaciones
        if (name && name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la conexión no puede estar vacío'
            });
        }

        // Verificar nombre único si se está cambiando
        if (name && name.trim() !== connection.connection_name) {
            const existingConnection = await Connection.findOne({
                where: {
                    connection_name: name.trim(),
                    tenant_id: tenantId,
                    id: { [require('sequelize').Op.ne]: id }
                }
            });

            if (existingConnection) {
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe una conexión con este nombre'
                });
            }
        }

        // Actualizar campos
        const updateData = {
            updated_at: new Date()
        };

        if (name !== undefined) updateData.connection_name = name.trim();
        if (greetingMessage !== undefined) updateData.welcome_message = greetingMessage || null;
        if (farewellMessage !== undefined) updateData.goodbye_message = farewellMessage || null;
        if (department !== undefined) updateData.department = department;
        if (botResetMinutes !== undefined) updateData.chatbot_timeout = botResetMinutes;

        await connection.update(updateData);

        structuredLogger.info('CONNECTIONS_API', 'Connection updated', {
            connectionId: id,
            updatedFields: Object.keys(updateData),
            correlationId: req.correlationId
        });

        res.json({
            success: true,
            message: 'Conexión actualizada exitosamente',
            data: {
                id: connection.id,
                name: connection.connection_name,
                department: connection.department,
                status: connection.status,
                updatedAt: connection.updated_at
            }
        });

    } catch (error) {
        structuredLogger.error('CONNECTIONS_API', 'Error updating connection', error, {
            connectionId: req.params.id,
            correlationId: req.correlationId
        });
        
        res.status(500).json({
            success: false,
            message: 'Error al actualizar la conexión'
        });
    }
});

/**
 * UPDATE - Cambiar estado de conexión
 * PATCH /api/connections/:id/status
*/
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const tenantId = req.tenantId || req.headers['x-tenant-id'] || 'tenant_001';

        const validStatuses = ['active', 'inactive', 'error', 'connecting'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Estado inválido'
            });
        }

        const connection = await Connection.findOne({
            where: { id, tenant_id: tenantId }
        });

        if (!connection) {
            return res.status(404).json({
                success: false,
                message: 'Conexión no encontrada'
            });
        }

        await connection.updateStatus(status);

        res.json({
            success: true,
            message: 'Estado actualizado exitosamente',
            data: { id: connection.id, status: connection.status }
        });

    } catch (error) {
        structuredLogger.error('CONNECTIONS_API', 'Error updating connection status', error, {
            connectionId: req.params.id,
            correlationId: req.correlationId
        });
        
        res.status(500).json({
            success: false,
            message: 'Error al actualizar el estado'
        });
    }
});

module.exports = router;