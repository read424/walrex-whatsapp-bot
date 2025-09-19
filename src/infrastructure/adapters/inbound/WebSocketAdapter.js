const { Server } = require('socket.io');
const WebSocketPort = require('../outbound/WebSocketPort');

class WebSocketAdapter extends WebSocketPort {

    constructor(httpServer){
        super();
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
        }catch(error){
            console.log('error ws: ', error)
        }
    }

    initSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('Cliente conectado:', socket.id);

            // Manejar unión a tenant específico - CORREGIDO
            socket.on('join', (data) => {
                const tenantId = typeof data === 'string' ? data : data?.tenantId || data;
                this.joinTenant(socket, tenantId);
            });

            // Manejar desconexión
            socket.on('disconnect', () => {
                console.log('Cliente desconectado:', socket.id);
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
            
            console.log(`Socket ${socket.id} joined tenant ${tenantIdStr}`);
            
            // Confirmar unión al cliente
            socket.emit('tenant_joined', { 
                tenantId: tenantIdStr, 
                message: `Successfully joined tenant ${tenantIdStr}` 
            });

        } catch (error) {
            console.error('Error joining tenant:', error);
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
                
                console.log(`Socket ${socket.id} left tenant ${currentTenantId}`);
            }
        } catch (error) {
            console.error('Error leaving tenant:', error);
        }
    }

    /**
     * Emite mensaje a un tenant específico
     */
    emitToTenant(tenantId, event, data) {
        try {
            const tenantIdStr = String(tenantId);
            console.log(`🚀 Emitting ${event} to tenant room: ${tenantIdStr}`, data);

            this.io.to(tenantIdStr).emit(event, data);

        } catch (error) {
            console.error(`Error emitting to tenant ${tenantId}:`, error);
        }
    }

    /**
     * Emite QR específicamente a un tenant
     */
    emitQRToTenant(tenantId, qrData) {
        const payload = {
            tenantId: String(tenantId),
            clientId: qrData.clientId,
            qr: qrData.qr, // Agregar ambos nombres por compatibilidad
            timestamp: new Date().toISOString(),
            message: 'Scan this QR code with WhatsApp'
        };

        console.log('📱 Emitting QR to tenant:', tenantId, 'Client:', qrData.clientId);

        this.emitToTenant(tenantId, 'qrCode', payload);
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

        console.log('Emitting connection status to tenant:', tenantId, 'Status:', statusData.status);

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
            console.log('Broadcasting to all clients:', message?.type || 'unknown');
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
}

module.exports = WebSocketAdapter;