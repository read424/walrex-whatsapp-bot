const fs = require('fs').promises;
const path = require('path');
const { WhatsAppConnection } = require('../../../models/index');
const { structuredLogger } = require('../../config/StructuredLogger');
const { Op } = require('sequelize');

class AdminConnectionManager {
    constructor(){
        this.sessionsBasePath = path.join(__dirname, '../../../sessions');
    }

    /**
     * Cierra todas las conexiones activas y limpia archivos de sesión
     */
    async disconectAllConnections(){
        try {
            structuredLogger.info('AdminConnectionManager', 'Starting mass disconnection process');

            // 1. Obtener todas las conexiones activas
            const activeConnections = await WhatsAppConnection.findAll({
                where: {
                    isActive: true,
                    status: ['connected', 'authenticated', 'connecting']
                }
            });

            structuredLogger.info('AdminConnectionManager', 'Found active connections', {
                count: activeConnections.length,
                connections: activeConnections.map( c => ({
                    clientId: c.clientId,
                    status: c.status,
                    phoneNumber: c.phoneNumber
                }))
            });

            // 2. Actualizar estado en base de datos
            await WhatsAppConnection.update(
                {
                    status: 'disconnected',
                    lastError: 'Administrative disconnection',
                    lastSeen: new Date()
                },
                {
                    where: {
                        isActive: true,
                        status: ['connected', 'authenticated', 'connecting']
                    }
                }
            );

            // 3. Limpiar todos los archivos de sesión
            const deletedSessions = await this.clearAllSessionFiles();

            structuredLogger.info('AdminConnectionManager', 'Mass disconnection completed', {
                disconnectedConnections: activeConnections.length,
                deletedSessionDirs: deletedSessions
            });

            return {
                success: true,
                disconnectedConnections: activeConnections.length,
                deletedSessions: deletedSessions,
                message: `${result.affectedRows || result[0]} conexiones desconectadas y ${deletedSessions} directorios de sesión eliminados`
            };

        }catch(error){
            structuredLogger.error('AdminConnectionManager', 'Error deactivating connections', error);
            throw error;
        }
    }

    /**
     * Limpia todos los archivos de sesión del sistema
     */    
    async clearAllSessionFiles(){
        try {
            let deletedCount = 0;

            // Verificar si el directorio base existe
            if (!await this.directoryExists(this.sessionsBasePath)){
                structuredLogger.info('AdminConnectionManager', 'Sessions directory does not exist', {
                    path: this.sessionsBasePath
                });
                return deletedCount;
            }

            // Obtener todos los subdirectorios de sesiones
            const sessionDirs = await fs.readdir(this.sessionsBasePath);

            for (const dirName of sessionDirs){
                const sessionPath = path.join(this.sessionsBasePath, dirName);

                try {
                    const stats = await fs.stat(sessionPath);

                    if (stats.isDirectory()){
                        await fs.rmdir(sessionPath, { recursive: true });
                        deletedCount++;

                        structuredLogger.info('AdminConnectionManager', 'Session directory deleted', {
                            clientId: dirName,
                            path: sessionPath
                        });
                    }
                }catch(dirError){
                    structuredLogger.warn('AdminConnectionManager', 'Failed to delete session directory', {
                        dirName,
                        path: sessionPath,
                        error: dirError.message
                    });
                }
            }

            structuredLogger.info('AdminConnectionManager', 'Session cleanup completed', {
                deletedDirectories: deletedCount,
                totalChecked: sessionDirs.length
            });

            return deletedCount;
        }catch(error){
            structuredLogger.error('AdminConnectionManager', 'Error during session cleanup', error);
            throw error;
        }
    }

    /**
     * Desactiva todas las conexiones en la base de datos sin eliminar registros
    */
    async deactivateAllConnections(){
        try {
            structuredLogger.info('AdminConnectionManager', 'Deactivating all connections');

            const result = await WhatsAppConnection.update(
                {
                    isActive: false,
                    status: 'disconnected',
                    lastError: 'Administrative disconnection',
                    lastSeen: new Date(),
                    qrCode: null
                },
                {
                    where: {
                        isActive: true,
                    }
                }
            );

            structuredLogger.info('AdminConnectionManager', 'All connections deactivated', {
                affectedRows: result.affectedRows || result[0]
            });

            return {
                success: true,
                deactivatedConnections: result.affectedRows || result[0],
                message: `${result.affectedRows || result[0]} conexiones desactivadas`
            }

        }catch(error){
            structuredLogger.error('AdminConnectionManager', 'Error deactivating connections', error);
            throw error;
        }
    }

    /**
     * Elimina conexiones especificas por clientId
    */
    async disconnectSpecificConnection(clientId){
        try {
            structuredLogger.info('AdminConnectionManager', 'Disconnecting specific connection', {
                clientId
            });

            // 1. Buscar la conexion
            const connection = await WhatsAppConnection.findOne({
                where: { clientId, isActive: true }
            });

            if (!connection) {
                return {
                    success: false,
                    message: `Conexón con clientId '${clientId}' no encontrada`
                }
            }

            // 2. Actualizar estado en BD
            await connection.update({
                status: 'disconnected',
                lastError: 'Administrative disconnection',
                lastSeen: new Date(),
                qrCode: null
            });

            // 3. Limpiar archivos de session especificos
            const sessionPath = path.join(this.sessionsBasePath, clientId);
            let sessionDeleted = false;

            if (await this.directoryExists(sessionPath)){
                await fs.rmdir(sessionPath, { recursive: true });
                sessionDeleted = true;

                structuredLogger.info('AdminConnectionManager', 'Session directory deleted', {
                    clientId,
                    path: sessionPath
                });
            }

            structuredLogger.info('AdminConnectionManager', 'Connection disconnected', {
                clientId,
                sessionDeleted
            });

            return {
                success: true,
                clientId,
                sessionDeleted,
                message: `Conexón '${clientId}' desconectada${sessionDeleted ? ' y directorio de sesión eliminado' : ''}`
            }
        }catch(error){
            structuredLogger.error('AdminConnectionManager', 'Error disconnecting specific connection', error, {
                clientId
            });
            throw error;
        }
    }

    /**
     * Lista todas las conexiones con su estado
    */
    async listAllConnections(){
        try {
            const connections = await WhatsAppConnection.findAll({
                order: [['createdAt', 'DESC']],
                attributes: [
                    'id', 'clientId', 'tenantId', 'phoneNumber', 'status',
                    'lastSeen', 'connectionAttempts', 'isActive', 'createdAt', 'updatedAt'
                ]
            });

            const summary = {
                total: connections.length,
                active: connections.filter(c => c.isActive).length,
                connected: connections.filter(c => c.status === 'connected' || c.status === 'authenticated').length,
                disconnected: connections.filter(c => c.status === 'disconnected').length,
                error: connections.filter(c => c.status === 'error').length
            };

            structuredLogger.info('AdminConnectionManager', 'All connections listed', summary);

            return {
                success: true,
                summary,
                connections: connections.map( c => ({
                    id: c.id,
                    clientId: c.clientId,
                    tenantId: c.tenantId,
                    phoneNumber: c.phoneNumber,
                    status: c.status,
                    isActive: c.isActive,
                    lastSeen: c.lastSeen,
                    connectionAttempts: c.connectionAttempts,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt
                }))
            };
        }catch(error){
            structuredLogger.error('AdminConnectionManager', 'Error listing all connections', error);
            throw error;
        }
    }

    /**
     *  Limpia conexiones antiguas basadas en criterios específicos
    */
   async cleanupOldConnections(options = {}){
        try {
            const {
                daysOld = 7,
                onlyDisconnected = true,
                deleteSessionFiles = true
            } = options;

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            structuredLogger.info('AdminConnectionManager', 'Starting connection cleanup', {
                cutoffDate,
                daysOld,
                onlyDisconnected,
                deleteSessionFiles
            });

            // Construir condiciones WHERE
            const whereConditions = {
                updatedAt: {
                    [Op.lt]: cutoffDate
                }
            };

            if (onlyDisconnected) {
                whereConditions.status = 'disconnected';
            }

            // Obtener conexiones a limpiar antes de eliminarlas
            const connectionsToDelete = WhatsAppConnection.findAll({
                where: whereConditions,
                attributes: ['id', 'clientId', 'status', 'updatedAt']
            });

            let deletedSessionDirs = 0;

            //Eliminar archivos de session si esta habilitado
            if(deleteSessionFiles){
                for (const connection of connectionsToDelete){
                    const sessionPath = path.join(this.sessionsBasePath, connection.clientId);

                    if (await this.directoryExists(sessionPath)){
                        try {
                            await fs.rmdir(sessionPath, { recursive: true });
                            deletedSessionDirs++;
                        }catch(sessionError){
                            structuredLogger.warn('AdminConnectionManager', 'Error deleting session for cleanup', {
                                clientId: connection.clientId,
                                error: sessionError.message
                            });
                        }
                    }
                }
            }

            // Eliminar registros de la base de datos
            const deletedCount = await WhatsAppConnection.destroy({
                where: whereConditions
            });

            structuredLogger.info('AdminConnectionManager', 'Connection cleanup completed', {
                deletedRecords: deletedCount,
                deletedSessionDirs,
                cutoffDate,
            });

            return {
                success: true,
                deletedRecords: deletedCount,
                deletedSessionDirs,
                cutoffDate,
                message: `${deletedCount} registros antiguos eliminados${deleteSessionFiles ? `, ${deletedSessionDirs} directorios de sesión eliminados` : ''}`
            };
        }catch(error){
            structuredLogger.error('AdminConnectionManager', 'Error during connection cleanup', error);
            throw error;
        }
   }

    /** 
    * Reestablecer una conexion especifica limpiando su sesion
    */
    async resetConnection(clientId){
        try {
            structuredLogger.info('AdminConnectionManager', 'Resetting connection', { clientId });

            const connection = await WhatsAppConnection.findOne({
                where: { clientId, isActive: true }
            });

            if (!connection){
                return {
                    success: false,
                    message: `Conexón con clientId '${clientId}' no encontrada`
                };
            }

            // Limpiar datos de sesion
            await connection.update({
                sessionData: null,
                qrCode: null,
                status: 'disconnected',
                lastError: 'Connection reset',
                lastSeen: new Date()
            });

            // Eliminar archivos de sesión
            const sessionPath = path.join(this.sessionsBasePath, clientId);
            let sessionDeleted = false;

            if (await this.directoryExists(sessionPath)){
                await fs.rmdir(sessionPath, { recursive: true });
                sessionDeleted = true;
            }

            structuredLogger.info('AdminConnectionManager', 'Connection reset completed', {
                clientId,
                sessionDeleted
            });

            return {
                success: true,
                clientId,
                sessionDeleted,
                message: `Conexón '${clientId}' reiniciada${sessionDeleted ? ' y archivos eliminados' : ''}`
            };

        }catch(error){
            structuredLogger.error('AdminConnectionManager', 'Error resetting connection', error, { clientId });
            throw error;
        }
    }

    async directoryExists(dirPath){
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        }catch(error){
            return false;
        }
    }

    /**
     * Obtiene estadisticas detalladas del sistema
    */
    async getSystemStats(){
        try {
            const connections = await WhatsAppConnection.findAll({
                attributes: ['status', 'isActive', 'tenantId', 'createdAt']
            });

            // Calcular estadistica por estado
            const statusStats = connections.reduce((acc, conn)=> {
                acc[conn.status] = (acc[conn.status] || 0) + 1;
                return acc;
            }, {});

            // Estadisticas por tenant
            const tenantStats = connections.reduce((acc, conn)=>{
                const tenant = conn.tenantId || 'Sin tenant';
                acc[tenant] = (acc[tenant] || 0) + 1;
                return acc;
            }, {});

            // Contar directorios de ssion fisicos
            let sessionDirCount = 0;
            if (await this.directoryExists(this.sessionsBasePath)){
                const sessionDirs = await fs.readdir(this.sessionsBasePath);
                sessionDirCount = sessionDirs.length;
            }

            const stats = {
                totalConnections: connections.length,
                activeConnections: connections.filter(c => c.isActive).length,
                sessionDirectories: sessionDirCount,
                statusBreakdown: statusStats,
                tenantBreakdown: tenantStats,
                oldestConnection: connections.length > 0 
                    ? Math.min(...connections.map(c => new Date(c.createdAt).getTime()))
                    : null,
                newestConnection: connections.length > 0 
                    ? Math.max(...connections.map(c => new Date(c.createdAt).getTime()))
                    : null,
            };

            structuredLogger.info('AdminConnectionManager', 'System stats retrieved', stats);

            return {
                success: true,
                stats,
                timestamp: new Date().toISOString()
            };
        }catch(error){
            structuredLogger.error('AdminConnectionManager', 'Error getting system stats', error);
            throw error;
        }
    }
}
module.exports = AdminConnectionManager;