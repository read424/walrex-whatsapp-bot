const { Server } = require('socket.io');
const NotificationPort = require('../../../application/ports/output/NotificationPort');

/**
 * Adaptador WebSocket que implementa NotificationPort
 * Implementa la abstracción de notificaciones usando Socket.IO
 * Este adaptador está en la capa de infraestructura
 */
class WebSocketAdapter extends NotificationPort {

    constructor(httpServer, logger){
        super();
        this.logger = logger;
        try{
            this.io = new Server(httpServer, {
                cors: {
                    origin: '*',
                    methods: ['GET', 'POST'],
                    credentials: true
                }
            });
            this.tenantRooms = new Map(); // Map<tenantId, Set<socketId>>
            this.socketTenants = new Map(); // Map<socketId, tenantId>
            this.initSocketEvents();
            this.logger.info('WebSocketAdapter', 'WebSocket server inicializado correctamente');
        }catch(error){
            this.logger.error('WebSocketAdapter', 'Error al inicializar WebSocket server', error);
            throw error;
        }
    }

    initSocketEvents() {
        this.io.on('connection', (socket) => {
            this.logger.info('WebSocketAdapter', 'Cliente conectado', { socketId: socket.id });

            // Manejar unión a tenant específico - CORREGIDO
            socket.on('join', (data) => {
                const tenantId = typeof data === 'string' ? data : data?.tenantId || data;
                this.joinTenant(socket, tenantId);
            });

            // Manejar desconexión
            socket.on('disconnect', () => {
                this.logger.info('WebSocketAdapter', 'Cliente desconectado', { socketId: socket.id });
                this.leaveTenant(socket);
            });

            // Manejar salida manual de tenant
            socket.on('leave', () => {
                this.leaveTenant(socket);
            });
        });
    }

    emit(event, data){
        this.io.emit(event, data);
    }

    /**
     * Une un socket a un tenant específico
     */
    joinTenant(socket, tenantId) {
        try {
            // Remover de tenant anterior si existe
            this.leaveTenant(socket);

            // Agregar al nuevo tenant
            const tenantIdStr = String(tenantId);

            if (!this.tenantRooms.has(tenantIdStr)) {
                this.tenantRooms.set(tenantIdStr, new Set());
            }

            this.tenantRooms.get(tenantIdStr).add(socket.id);
            this.socketTenants.set(socket.id, tenantIdStr);

            // Unir a la room de socket.io
            socket.join(tenantIdStr);

            this.logger.info('WebSocketAdapter', 'Socket joined tenant', {
                socketId: socket.id,
                tenantId: tenantIdStr
            });

            // Confirmar unión al cliente
            socket.emit('tenant_joined', {
                tenantId: tenantIdStr,
                message: `Successfully joined tenant ${tenantIdStr}`
            });

        } catch (error) {
            this.logger.error('WebSocketAdapter', 'Error joining tenant', error, {
                socketId: socket.id,
                tenantId: String(tenantId)
            });
            socket.emit('tenant_error', { error: 'Failed to join tenant' });
        }
    }

    /**
     * Remueve un socket de su tenant actual
     */
    leaveTenant(socket) {
        try {
            const currentTenantId = this.socketTenants.get(socket.id);

            if (currentTenantId) {
                // Remover de la room
                socket.leave(currentTenantId);

                // Limpiar mapas
                const tenantSockets = this.tenantRooms.get(currentTenantId);
                if (tenantSockets) {
                    tenantSockets.delete(socket.id);

                    // Si no quedan sockets en el tenant, remover el tenant
                    if (tenantSockets.size === 0) {
                        this.tenantRooms.delete(currentTenantId);
                    }
                }

                this.socketTenants.delete(socket.id);

                this.logger.info('WebSocketAdapter', 'Socket left tenant', {
                    socketId: socket.id,
                    tenantId: currentTenantId
                });
            }
        } catch (error) {
            this.logger.error('WebSocketAdapter', 'Error leaving tenant', error, {
                socketId: socket.id
            });
        }
    }

    /**
     * Emite mensaje a un tenant específico
     */
    emitToTenant(tenantId, event, data) {
        try {
            const tenantIdStr = String(tenantId);
            this.logger.debug('WebSocketAdapter', `Emitting ${event} to tenant`, {
                tenantId: tenantIdStr,
                event
            });

            this.io.to(tenantIdStr).emit(event, data);

        } catch (error) {
            this.logger.error('WebSocketAdapter', `Error emitting to tenant`, error, {
                tenantId: String(tenantId),
                event
            });
        }
    }

    /**
     * Emite QR específicamente a un tenant
     */
    emitQRToTenant(clientId, qrData) {
        const payload = {
            tenantId: String(qrData.tenantId),
            clientId: qrData.clientId,
            qr: qrData.qr, // Agregar ambos nombres por compatibilidad
            timestamp: new Date().toISOString(),
            message: 'Scan this QR code with WhatsApp'
        };

        this.logger.info('WebSocketAdapter', 'Emitting QR code to tenant', {
            tenantId: qrData.tenantId,
            clientId: clientId
        });

        this.emitToTenant(clientId, 'qrCode', payload);
    }

    /**
     * Emite estado de conexión a un tenant específico
     */
    emitConnectionStatusToTenant(tenantId, statusData) {
        const payload = {
            tenantId: String(tenantId),
            ...statusData,
            timestamp: new Date().toISOString()
        };

        this.logger.info('WebSocketAdapter', 'Emitting connection status to tenant', {
            tenantId: tenantId,
            status: statusData.status
        });

        this.emitToTenant(tenantId, 'connection_status', payload);

        // Emitir eventos específicos también
        if (statusData.status === 'ready') {
            this.emitToTenant(tenantId, 'whatsappReady', payload);
        } else if (statusData.status === 'disconnected') {
            this.emitToTenant(tenantId, 'whatsappDisconnected', payload);
        }
    }

    // Método para enviar mensajes a todos los clientes conectados (mantener compatibilidad)
    broadcast(message) {
        if (this.io) {
            this.logger.info('WebSocketAdapter', 'Broadcasting to all clients', {
                messageType: message?.type || 'unknown'
            });
            this.io.emit('whatsapp_status_update', message);
        }
    }

    /**
     * Obtiene información de tenants activos
     */
    getTenantsInfo() {
        const tenantsInfo = {};
        for (const [tenantId, sockets] of this.tenantRooms.entries()) {
            tenantsInfo[tenantId] = {
                connectedSockets: sockets.size,
                socketIds: Array.from(sockets)
            };
        }
        return tenantsInfo;
    }

    // === Implementación de métodos de NotificationPort ===

    /**
     * Implementación de NotificationPort.notifySessionUpdate
     * Notifica actualización de sesión a un tenant
     */
    async notifySessionUpdate(tenantId, sessionId, updates) {
        this.emitToTenant(tenantId, 'sessionUpdated', { sessionId, updates });
    }

    /**
     * Implementación de NotificationPort.notifyNewMessage
     * Notifica nuevo mensaje a un tenant
     */
    async notifyNewMessage(tenantId, message) {
        this.emitToTenant(tenantId, 'newMessage', message);
    }

    /**
     * Implementación de NotificationPort.notifyNewSession
     * Notifica nueva sesión a un tenant
     */
    async notifyNewSession(tenantId, session) {
        this.emitToTenant(tenantId, 'newSession', session);
    }

    /**
     * Implementación de NotificationPort.notifyUser
     * Notifica a un usuario específico (alias de emitToTenant para usuarios)
     */
    async notifyUser(userId, event, data) {
        this.emitToTenant(userId, event, data);
    }

    /**
     * Implementación de NotificationPort.notifyTenant
     * Notifica a un tenant con evento genérico (alias directo)
     */
    async notifyTenant(tenantId, event, data) {
        this.emitToTenant(tenantId, event, data);
    }
}

module.exports = WebSocketAdapter;