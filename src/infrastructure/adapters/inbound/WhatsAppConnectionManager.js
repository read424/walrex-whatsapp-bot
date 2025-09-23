const WhatsAppWebJsStrategy = require('./whatsappWebJsStrategy');
const { WhatsAppConnection, Connection } = require('../../../models');
const { WHATSAPP_LIBRARIES } = require('../../../domain/constants/WhatsAppConstants');
const structuredLogger = require('../../config/StructuredLogger');

class WhatsAppConnectionManager {
    constructor(webSocketAdapter){
        this.webSocketAdapter = webSocketAdapter;
        this.activeConnections = new Map();// Map<clientId, { strategy, connectionRecord, tenantId }>
        this.isInitialized = false;
        this.selectedLibrary = process.env.WHATSAPP_LIBRARY || WHATSAPP_LIBRARIES.WHATSAPP_WEB_JS;

        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.reconnectionAttempts = new Map(); // Track reconnection attempts per client
        this.maxReconnectionAttempts = parseInt(process.env.MAX_RECONNECTION_ATTEMPTS) || 3;
        this.reconnectionDelay = parseInt(process.env.RECONNECTION_DELAY) || 30000; // 30 seconds
        this.healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000; // 1 minute

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
                order: [['updated_at', 'DESC']],
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
            strategy.connectionRecord = await Connection.findByPk(connectionRecord.connectionId);
            
            await strategy.restoreSessionIfExists();
            await strategy.init();
            
            this.activeConnections.set(clientId, {
                strategy,
                connectionRecord,
                tenantId,
                lastHealthCheck: new Date(),
                reconnectionAttempts: 0
            });

            // Reset reconnection attempts on successful restore
            this.reconnectionAttempts.delete(clientId);

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
            const finalClientId = connectionId;
            const finalConnectionName = connectionName;
            const finalTenantId = tenantId;
            
            if (this.activeConnections.has(finalConnectionName)) {
                const existingConnection = this.activeConnections.get(finalConnectionName);

                if(existingConnection.connectionRecord?.status === 'disconnected' || existingConnection.connectionRecord?.status === 'inactive'){
                    //Limpiar la conexion existente y crear una nueva
                    await existingConnection.strategy.cleanup?.(); 
                    this.activeConnections.delete(finalConnectionName);
                }else if (existingConnection.connectionRecord?.status === 'connected' || existingConnection.connectionRecord?.status === 'authenticated') {
                    throw new Error(`Connection ${finalConnectionName} already exists with status ${existingConnection.connectionRecord?.status}`);
                }

                return {
                    success: true,
                    clientId: finalClientId,
                    connectionName: finalConnectionName,
                    status: existingConnection.connectionRecord?.status,
                    tenantId: finalTenantId,
                    message: `Connection ${finalConnectionName} already exists with status ${existingConnection.connectionRecord?.status}`,
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
                clientId: finalClientId,
                connectionName: finalConnectionName,
                tenantId: finalTenantId
            });

            const strategy = this.createStrategyInstance(finalConnectionName, finalTenantId);
            strategy.connectionId = finalClientId;
            
            await strategy.init();

            const whatsAppConnection = await WhatsAppConnection.getConnectionByName(finalConnectionName);
            if(!whatsAppConnection){
                throw new Error(`WhatsApp connection not found for ${finalConnectionName}`);
            }
            const connectionRecord = await Connection.findByPk(whatsAppConnection.connectionId);

            this.activeConnections.set(finalConnectionName, {
                strategy,
                connectionRecord,
                tenantId: finalTenantId,
                lastHealthCheck: new Date(),
                reconnectionAttempts: 0
            });

            structuredLogger.info('WhatsAppConnectionManager', 'New connection created', {
                clientId: finalClientId,
                connectionId: connectionRecord.id,
                tenantId: finalTenantId
            });

            return {
                success: true,
                clientId: finalClientId,
                connectionName: finalConnectionName,
                tenantId: finalTenantId,
                message: 'Connection created successfully',
                qr: strategy.getQR(),
                connectionRecord: {
                    id: connectionRecord.id,
                    clientId: connectionRecord.clientId,
                    status: connectionRecord.status,
                    createdAt: connectionRecord.createdAt,
                    updatedAt: connectionRecord.updatedAt
                }
            };

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Error creating new connection', error);
            throw error;
        }
    }

    async restartConnection(clientId, tenantId) {
        try {
            const connectionRecord = await Connection.findOne({
                where: {
                    id: clientId,
                    tenantId: tenantId
                }
            });
            if(!connectionRecord){
                throw new Error(`Connection ${clientId} not found`);
            }

            const connectionData = this.activeConnections.get(clientId);
            
            if (!connectionData) {
            }else{
                const { tenantId, connectionRecord } = connectionData;
            }


            structuredLogger.info('WhatsAppConnectionManager', 'Restarting connection', { clientId });

            // Clean up existing connection
            if (connectionData.strategy && connectionData.strategy.cleanup) {
                await connectionData.strategy.cleanup();
                this.activeConnections.delete(clientId);
            }

            // Reset reconnection attempts
            this.reconnectionAttempts.delete(clientId);

            //Crear nueva conexión
            const strategy = this.createStrategyInstance(clientId, tenantId);
            await strategy.init();

            const updatedConnectionRecord = await WhatsAppConnection.getConnectionByClientId(clientId);

            this.activeConnections.set(clientId, {
                strategy,
                connectionRecord: updatedConnectionRecord,
                tenantId,
                lastHealthCheck: new Date(),
                reconnectionAttempts: 0
            });

            return {
                success: true,
                clientId: clientId,
                message: 'Connection reiniciada correctamente'
            }
        }catch(error){
            structuredLogger.error('WhatsAppConnectionManager', 'Error restarting connection', error);
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
        if (!this.isInitialized) {
            structuredLogger.warn('WhatsAppConnectionManager', 'Cannot monitor - manager not initialized');
            return;
        }

        try {            
            structuredLogger.debug('WhatsAppConnectionManager', 'Monitoring connections', {
                totalConnections: this.activeConnections.size,
                timestamp: new Date().toISOString()
            });

            const monitoringPromises = [];

            for (const [clientId, connectionData] of this.activeConnections) {
                monitoringPromises.push(this.monitorSingleConnection(clientId, connectionData));
            }

            // Wait for all monitoring tasks to complete
            const results = await Promise.allSettled(monitoringPromises);

            // Log monitoring results
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            if (failed > 0) {
                structuredLogger.warn('WhatsAppConnectionManager', 'Some connections failed monitoring', {
                    successful,
                    failed,
                    totalConnections: this.activeConnections.size
                });
            } else {
                structuredLogger.debug('WhatsAppConnectionManager', 'Monitoring cycle completed', {
                    successful,
                    totalConnections: this.activeConnections.size
                });
            }            

            await this.cleanupOrphanConnections();

            // Check for dead connections and attempt reconnection
            await this.checkAndReconnectDeadConnections();

            // Broadcast system health status
            await this.broadcastSystemHealth();            

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Error monitoring connections', error);
        }
    }

    async monitorSingleConnection(clientId, connectionData) {
        try {
            const { strategy, connectionRecord, tenantId } = connectionData;
            
            // Get current connection state
            const connectionState = strategy.getConnectionState ? strategy.getConnectionState() : {
                isLoggedIn: strategy.isLoggedIn || false,
                isClientReady: strategy.isClientReady || false,
                hasClient: !!strategy.client
            };

            structuredLogger.debug('WhatsAppConnectionManager', 'Monitoring connection', {
                clientId,
                state: connectionState,
                lastHealthCheck: connectionData.lastHealthCheck
            });

            // Update last health check
            connectionData.lastHealthCheck = new Date();

            // Check if connection is healthy
            if (!connectionState.isLoggedIn || !connectionState.isClientReady) {
                structuredLogger.warn('WhatsAppConnectionManager', 'Connection unhealthy detected', {
                    clientId,
                    isLoggedIn: connectionState.isLoggedIn,
                    isClientReady: connectionState.isClientReady,
                    hasClient: connectionState.hasClient
                });

                // Mark connection as unhealthy
                await connectionRecord.updateStatus('disconnected', 'Connection lost during monitoring');
                
                // Add to reconnection queue
                await this.scheduleReconnection(clientId, connectionData);
                
            } else {
                // Connection is healthy, update database
                await connectionRecord.update({ 
                    lastSeen: new Date(),
                    status: 'connected'
                });

                // Reset reconnection attempts if connection is healthy
                connectionData.reconnectionAttempts = 0;
                this.reconnectionAttempts.delete(clientId);
            }

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Error monitoring single connection', error, { clientId });
            
            // If monitoring fails, schedule reconnection
            await this.scheduleReconnection(clientId, connectionData);
        }
    }    

    async scheduleReconnection(clientId, connectionData) {
        const currentAttempts = this.reconnectionAttempts.get(clientId) || 0;
        
        if (currentAttempts >= this.maxReconnectionAttempts) {
            structuredLogger.error('WhatsAppConnectionManager', 'Max reconnection attempts reached', {
                clientId,
                attempts: currentAttempts,
                maxAttempts: this.maxReconnectionAttempts
            });

            // Mark connection as permanently failed
            await connectionData.connectionRecord.updateStatus('failed', 'Max reconnection attempts exceeded');
            
            // Remove from active connections
            this.activeConnections.delete(clientId);
            this.reconnectionAttempts.delete(clientId);
            
            // Notify via WebSocket
            this.webSocketAdapter.emitToTenant(connectionData.tenantId, 'connection_failed', {
                clientId,
                reason: 'Max reconnection attempts exceeded',
                attempts: currentAttempts
            });

            return;
        }

        // Increment attempt counter
        this.reconnectionAttempts.set(clientId, currentAttempts + 1);

        structuredLogger.info('WhatsAppConnectionManager', 'Scheduling reconnection', {
            clientId,
            attempt: currentAttempts + 1,
            maxAttempts: this.maxReconnectionAttempts,
            delayMs: this.reconnectionDelay
        });

        // Schedule reconnection after delay
        setTimeout(async () => {
            await this.attemptReconnection(clientId, connectionData);
        }, this.reconnectionDelay);
    }

    async attemptReconnection(clientId, connectionData) {
        const currentAttempt = this.reconnectionAttempts.get(clientId) || 0;
        
        try {
            structuredLogger.info('WhatsAppConnectionManager', 'Attempting reconnection', {
                clientId,
                attempt: currentAttempt,
                timestamp: new Date().toISOString()
            });

            const { strategy, connectionRecord, tenantId } = connectionData;

            // Update status to connecting
            await connectionRecord.updateStatus('connecting', `Reconnection attempt ${currentAttempt}`);

            // Clean up existing strategy
            if (strategy && strategy.cleanup) {
                await strategy.cleanup();
            }

            // Create new strategy instance
            const newStrategy = this.createStrategyInstance(clientId, tenantId);
            newStrategy.connectionRecord = connectionRecord;

            // Try to restore session first
            await newStrategy.restoreSessionIfExists();
            
            // Initialize new connection
            await newStrategy.init();

            // Update active connections map
            this.activeConnections.set(clientId, {
                strategy: newStrategy,
                connectionRecord,
                tenantId,
                lastHealthCheck: new Date(),
                reconnectionAttempts: currentAttempt
            });

            structuredLogger.info('WhatsAppConnectionManager', 'Reconnection successful', {
                clientId,
                attempt: currentAttempt
            });

            // Reset reconnection attempts
            this.reconnectionAttempts.delete(clientId);

            // Notify success
            this.webSocketAdapter.emitToTenant(tenantId, 'connection_restored', {
                clientId,
                attempt: currentAttempt,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Reconnection failed', error, {
                clientId,
                attempt: currentAttempt
            });

            // Update connection record with error
            await connectionData.connectionRecord.updateStatus('error', 
                `Reconnection attempt ${currentAttempt} failed: ${error.message}`);

            // Schedule next attempt if not exceeded max
            if (currentAttempt < this.maxReconnectionAttempts) {
                await this.scheduleReconnection(clientId, connectionData);
            }
        }
    }
    
    async checkAndReconnectDeadConnections() {
        try {
            const deadConnectionThreshold = new Date(Date.now() - (5 * 60 * 1000)); // 5 minutes ago
            
            for (const [clientId, connectionData] of this.activeConnections) {
                const { lastHealthCheck, strategy, connectionRecord } = connectionData;
                
                // Check if connection hasn't been checked recently
                if (lastHealthCheck < deadConnectionThreshold) {
                    structuredLogger.warn('WhatsAppConnectionManager', 'Dead connection detected', {
                        clientId,
                        lastHealthCheck: lastHealthCheck.toISOString(),
                        threshold: deadConnectionThreshold.toISOString()
                    });

                    // Mark as dead and schedule reconnection
                    await connectionRecord.updateStatus('dead', 'No recent health check');
                    await this.scheduleReconnection(clientId, connectionData);
                }
            }

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Error checking dead connections', error);
        }
    }

    startMonitoring(intervalMs = null) {
        if (this.isMonitoring) {
            structuredLogger.warn('WhatsAppConnectionManager', 'Monitoring already started');
            return;
        }

        const interval = intervalMs || this.healthCheckInterval;
        
        structuredLogger.info('WhatsAppConnectionManager', 'Starting connection monitoring', {
            intervalMs: interval,
            maxReconnectionAttempts: this.maxReconnectionAttempts,
            reconnectionDelay: this.reconnectionDelay
        });

        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.monitorConnections().catch(error => {
                structuredLogger.error('WhatsAppConnectionManager', 'Monitoring interval error', error);
            });
        }, interval);

        // Also run immediate check
        this.monitorConnections();
    }

    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        structuredLogger.info('WhatsAppConnectionManager', 'Stopping connection monitoring');
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        this.isMonitoring = false;
    }

    getMonitoringStatus() {
        const activeConnections = Array.from(this.activeConnections.entries()).map(([clientId, data]) => ({
            clientId,
            tenantId: data.tenantId,
            status: data.connectionRecord.status,
            lastHealthCheck: data.lastHealthCheck,
            reconnectionAttempts: data.reconnectionAttempts || 0
        }));

        const reconnectionQueue = Array.from(this.reconnectionAttempts.entries()).map(([clientId, attempts]) => ({
            clientId,
            attempts
        }));

        return {
            isMonitoring: this.isMonitoring,
            totalConnections: this.activeConnections.size,
            activeConnections,
            reconnectionQueue,
            maxReconnectionAttempts: this.maxReconnectionAttempts,
            reconnectionDelay: this.reconnectionDelay,
            healthCheckInterval: this.healthCheckInterval
        };
    }

    async broadcastSystemHealth() {
        try {
            const status = this.getMonitoringStatus();
            const healthyConnections = status.activeConnections.filter(c => 
                c.status === 'connected' || c.status === 'authenticated'
            ).length;

            const healthStatus = {
                status: 'healthy',
                totalConnections: status.totalConnections,
                healthyConnections,
                unhealthyConnections: status.totalConnections - healthyConnections,
                reconnectionQueue: status.reconnectionQueue.length,
                timestamp: new Date().toISOString()
            };

            // Determine overall health
            if (healthyConnections === 0 && status.totalConnections > 0) {
                healthStatus.status = 'critical';
            } else if (healthyConnections < status.totalConnections) {
                healthStatus.status = 'warning';
            }

            this.webSocketAdapter.broadcast({
                type: 'system_health',
                data: healthStatus
            });

        } catch (error) {
            structuredLogger.error('WhatsAppConnectionManager', 'Error broadcasting system health', error);
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
        return `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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

    async shutdown() {
        structuredLogger.info('WhatsAppConnectionManager', 'Starting graceful shutdown');
        
        // Stop monitoring
        this.stopMonitoring();
        
        // Disconnect all connections
        const disconnectPromises = Array.from(this.activeConnections.entries()).map(
            async ([clientId, connectionData]) => {
                try {
                    if (connectionData.strategy && connectionData.strategy.cleanup) {
                        await connectionData.strategy.cleanup();
                    }
                    structuredLogger.info('WhatsAppConnectionManager', 'Connection cleaned up', { clientId });
                } catch (error) {
                    structuredLogger.error('WhatsAppConnectionManager', 'Error cleaning up connection', error, { clientId });
                }
            }
        );

        await Promise.allSettled(disconnectPromises);
        
        this.activeConnections.clear();
        this.reconnectionAttempts.clear();
        
        structuredLogger.info('WhatsAppConnectionManager', 'Graceful shutdown completed');
    }    
}

module.exports = WhatsAppConnectionManager;