const WhatsAppWebJsStrategy = require('./whatsappWebJsStrategy');
const { WhatsAppConnection } = require('../../../models');
const { WHATSAPP_LIBRARIES } = require('../../../domain/constants/WhatsAppConstants');
const structuredLogger = require('../../config/StructuredLogger');

class WhatsAppConnectionManager {
    constructor(webSocketAdapter){
        this.webSocketAdapter = webSocketAdapter;
        this.activeConnections = new Map();// Map<clientId, { strategy, connectionRecord, tenantId }>
        this.isInitialized = false;
        this.selectedLibrary = process.env.WHATSAPP_LIBRARY || WHATSAPP_LIBRARIES.WHATSAPP_WEB_JS;

        // Validar la librería seleccionada
        this.validateSelectedLibrary();        
    }

    /**
     * Valida que la librería seleccionada sea compatible
     */
    validateSelectedLibrary() {
        structuredLogger.info('WhatsAppConnectionManager', 'Validating WhatsApp library', {
            selectedLibrary: this.selectedLibrary
        });

        if (this.selectedLibrary === WHATSAPP_LIBRARIES.VENOM) {
            structuredLogger.warn('WhatsAppConnectionManager', 'Venom library is deprecated and not supported');
            throw new Error('Venom library is deprecated. Please use WHATSAPP_WEB_JS instead.');
        }

        if (this.selectedLibrary !== WHATSAPP_LIBRARIES.WHATSAPP_WEB_JS) {
            structuredLogger.error('WhatsAppConnectionManager', 'Unsupported library', null, {
                selectedLibrary: this.selectedLibrary,
                supportedLibraries: Object.values(WHATSAPP_LIBRARIES)
            });
            throw new Error(`Library '${this.selectedLibrary}' not supported. Use: ${WHATSAPP_LIBRARIES.WHATSAPP_WEB_JS}`);
        }

        structuredLogger.info('WhatsAppConnectionManager', 'Library validation successful', {
            selectedLibrary: this.selectedLibrary
        });
    }    

    /**
     * Crea una instancia de la estrategia según la librería seleccionada
     */
    createStrategyInstance(connectionName, tenantId) {
        switch (this.selectedLibrary) {
            case WHATSAPP_LIBRARIES.WHATSAPP_WEB_JS:
                return new WhatsAppWebJsStrategy(this.webSocketAdapter, connectionName, tenantId);
            
            default:
                throw new Error(`Strategy for library '${this.selectedLibrary}' not implemented`);
        }
    }

    /**
     * Inicializa el gestor y restaura conexiones desde la base de datos
    */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            structuredLogger.info('WhatsAppConnectionManager', 'Initializing connection manager');

            await this.restoreConnectionsFromDatabase();
            
            this.isInitialized = true;
            
            structuredLogger.info('WhatsAppConnectionManager', 'Connection manager initialized', {
                activeConnections: this.activeConnections.size
            });

            this.broadcastSystemStatus('Sistema iniciado correctamente');

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Failed to initialize', error);
            throw error;
        }
    }


    /**
     * Restaura conexiones existentes desde la base de datos
    */
    async restoreConnectionsFromDatabase() {
        try {
            const existingConnections = await WhatsAppConnection.findAll({
                where: {
                    isActive: true,
                    status: ['authenticated', 'connected']
                },
                order: [['updated_at', 'DESC']]
            });

            structuredLogger.info('WhatsAppConnectionManager', 'Found existing connections', {
                count: existingConnections.length
            });

            if (existingConnections.length === 0) {
                this.broadcastSystemStatus('Sin conexiones existentes - Sistema listo');
                return;
            }

            const restorationResults = await Promise.allSettled(
                existingConnections.map(conn => this.restoreConnection(conn))
            );

            const successful = restorationResults.filter(r => r.status === 'fulfilled').length;

            structuredLogger.info('WhatsAppConnectionManager', 'Connection restoration completed', {
                total: existingConnections.length,
                successful,
                failed: existingConnections.length - successful
            });

            this.broadcastSystemStatus(`${successful}/${existingConnections.length} conexiones restauradas`);

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Error restoring connections', error);
            throw error;
        }
    }

    /**
     * Restaura una conexión específica
     */
    async restoreConnection(connectionRecord) {
        const { clientId, tenantId } = connectionRecord;
        
        try {
            structuredLogger.info('WhatsAppConnectionManager', 'Restoring connection', { clientId });

            const strategy = this.createStrategyInstance(clientId, tenantId);
            strategy.connectionRecord = connectionRecord;
            
            await strategy.restoreSessionData();
            await strategy.init();
            
            this.activeConnections.set(clientId, {
                strategy,
                connectionRecord,
                tenantId
            });

            structuredLogger.info('WhatsAppConnectionManager', 'Connection restored', { clientId });
            
            return strategy;

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Failed to restore connection', error, { clientId });
            await connectionRecord.updateStatus('error', `Restoration failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Crea una nueva conexión
     */
    async createNewConnection(connectionId, connectionName = null, tenantId = null) {
        try {
            const finalClientId = connectionName || this.generateClientId();
            const finalTenantId = tenantId || 'tenant_001';
            
            if (this.activeConnections.has(finalClientId)) {
                const existingConnection = this.activeConnections.get(finalClientId);
                if (existingConnection.connectionRecord?.status === 'connected' || existingConnection.connectionRecord?.status === 'authenticated') {
                    throw new Error(`Connection ${finalClientId} already exists with status ${existingConnection.connectionRecord?.status}`);
                }

                return {
                    success: true,
                    clientId: finalClientId,
                    status: existingConnection.connectionRecord?.status,
                    tenantId: finalTenantId,
                    message: `Connection ${finalClientId} already exists with status ${existingConnection.connectionRecord?.status}`,
                    qr: existingConnection.strategy.getQRCode(),
                    connectionRecord: {
                        id: existingConnection?.connectionRecord?.id,
                        clientId: existingConnection?.connectionRecord?.clientId,
                        status: existingConnection?.connectionRecord?.status,
                        createdAt: existingConnection?.connectionRecord?.createdAt,
                        updatedAt: existingConnection?.connectionRecord?.updatedAt
                    }
                };
            }

            structuredLogger.info('WhatsAppConnectionManager', 'Creating new connection', {
                connectionId: finalClientId,
                tenantId: finalTenantId
            });

            const strategy = this.createStrategyInstance(finalClientId, finalTenantId);
            await strategy.init();

            const connectionRecord = await WhatsAppConnection.getConnectionByClientId(finalClientId);

            this.activeConnections.set(finalClientId, {
                strategy,
                connectionRecord,
                tenantId
            });

            structuredLogger.info('WhatsAppConnectionManager', 'New connection created', {
                clientId: finalClientId
            });

            //this.webSocketAdapter.broadcast({
            //    type: 'connection_created',
            //    clientId: finalClientId,
            //    tenantId,
            //    activeConnections: this.activeConnections.size,
            //    timestamp: new Date().toISOString()
            //});

            return {
                success: true,
                clientId: finalClientId,
                status: strategy.connectionRecord?.status || 'connecting',
                tenantId: tenantId,
                qr: strategy.getQRCode(),
                connectionRecord: {
                    id: connectionRecord?.id,
                    clientId: connectionRecord?.clientId,
                    status: connectionRecord?.status,
                    createdAt: connectionRecord?.createdAt,
                    updatedAt: connectionRecord?.updatedAt
                },
                message: 'WhatsApp connection created successfully'
            };

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Error creating connection', error, {
                connectionId,
                tenantId
            });
            throw error;
        }
    }

    /**
     * Desconecta una conexión específica
     */
    async disconnectConnection(clientId) {
        try {
            const connectionData = this.activeConnections.get(clientId);
            
            if (!connectionData) {
                return {
                    success: false,
                    message: `Connection ${clientId} not found`
                };
            }

            structuredLogger.info('WhatsAppConnectionManager', 'Disconnecting connection', { clientId });

            const { strategy } = connectionData;
            await strategy.disconnect();
            
            this.activeConnections.delete(clientId);

            structuredLogger.info('WhatsAppConnectionManager', 'Connection disconnected', {
                clientId,
                remainingConnections: this.activeConnections.size
            });

            this.webSocketAdapter.broadcast({
                type: 'connection_disconnected',
                clientId,
                activeConnections: this.activeConnections.size,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                message: `Connection ${clientId} disconnected`,
                activeConnections: this.activeConnections.size
            };

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Error disconnecting connection', error, { clientId });
            throw error;
        }
    }

    /**
     * Desconecta todas las conexiones
     */
    async disconnectAllConnections() {
        try {
            structuredLogger.info('WhatsAppConnectionManager', 'Disconnecting all connections', {
                totalConnections: this.activeConnections.size
            });

            const disconnectPromises = Array.from(this.activeConnections.keys()).map(
                clientId => this.disconnectConnection(clientId)
            );

            const results = await Promise.allSettled(disconnectPromises);
            const successful = results.filter(r => r.status === 'fulfilled').length;

            structuredLogger.info('WhatsAppConnectionManager', 'All connections disconnected', {
                successful,
                failed: results.length - successful
            });

            return {
                success: true,
                disconnected: successful,
                failed: results.length - successful
            };

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Error disconnecting all connections', error);
            throw error;
        }
    }

    /**
     * Monitorea todas las conexiones activas
     */
    async monitorConnections() {
        try {
            structuredLogger.debug('WhatsAppConnectionManager', 'Monitoring connections', {
                totalConnections: this.activeConnections.size
            });

            for (const [clientId, connectionData] of this.activeConnections) {
                try {
                    const { strategy, connectionRecord } = connectionData;
                    const status = strategy.getClientStatus();
                    
                    if (!status.isLoggedIn) {
                        structuredLogger.warn('WhatsAppConnectionManager', 'Connection not authenticated', { clientId });
                        await connectionRecord.updateStatus('disconnected', 'Lost authentication during monitoring');
                    } else {
                        await connectionRecord.update({ lastSeen: new Date() });
                    }
                    
                } catch (connectionError) {
                    structuredLogger.error('WhatsAppConnectionManager', 'Error monitoring connection', connectionError, { clientId });
                }
            }

            await this.cleanupOrphanConnections();

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Error monitoring connections', error);
        }
    }

    /**
     * Limpia conexiones huérfanas en la base de datos
     */
    async cleanupOrphanConnections() {
        try {
            const dbConnections = await WhatsAppConnection.findAll({
                where: {
                    isActive: true,
                    status: ['connected', 'authenticated']
                }
            });

            for (const dbConnection of dbConnections) {
                if (!this.activeConnections.has(dbConnection.clientId)) {
                    structuredLogger.warn('WhatsAppConnectionManager', 'Cleaning orphan connection', {
                        clientId: dbConnection.clientId
                    });
                    
                    await dbConnection.updateStatus('disconnected', 'Orphan cleanup');
                }
            }
        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Error cleaning orphan connections', error);
        }
    }

    /**
     * Obtiene el estado de todas las conexiones
     */
    getConnectionsStatus() {
        const connections = Array.from(this.activeConnections.entries()).map(([clientId, data]) => ({
            clientId,
            tenantId: data.tenantId,
            status: data.strategy.getClientStatus(),
            lastSeen: data.connectionRecord?.lastSeen
        }));

        return {
            totalConnections: this.activeConnections.size,
            connections
        };
    }

    /**
     * Obtiene una conexión específica
     */
    getConnection(clientId) {
        return this.activeConnections.get(clientId);
    }

    /**
     * Verifica si una conexión existe
     */
    hasConnection(clientId) {
        return this.activeConnections.has(clientId);
    }

    /**
     * Obtiene todas las conexiones activas
     */
    getAllConnections() {
        return this.activeConnections;
    }

    /**
     * Genera un ID único para cliente
     */
    generateClientId() {
        return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Emite el estado del sistema por WebSocket
     */
    broadcastSystemStatus(message) {
        this.webSocketAdapter.broadcast({
            type: 'system_status',
            message,
            activeConnections: this.activeConnections.size,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Destructor para limpieza
     */
    async destroy() {
        await this.disconnectAllConnections();
        this.activeConnections.clear();
        this.isInitialized = false;
    }
}

module.exports = WhatsAppConnectionManager;