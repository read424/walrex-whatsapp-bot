const WhatsAppConnectionPort = require('../../../../application/ports/output/WhatsAppConnectionPort');

/**
 * Implementación del puerto WhatsAppConnectionPort
 *
 * Este adaptador conecta la capa de aplicación con el ConnectionManager existente.
 * Es el puente entre el caso de uso (que depende del puerto abstracto) y
 * la implementación concreta del sistema de gestión de conexiones.
 *
 * Responsabilidades:
 * - Traducir llamadas del puerto a llamadas del ConnectionManager
 * - Gestionar el ciclo de vida de las conexiones
 * - Proporcionar abstracción sobre el mecanismo de conexión real
 */
class WhatsAppConnectionPortImpl extends WhatsAppConnectionPort {
    /**
     * @param {Object} connectionManager - Gestor de conexiones de WhatsApp existente
     * @param {Object} logger - Adaptador de logging
     */
    constructor(connectionManager, logger) {
        super();

        if (!connectionManager) {
            throw new Error('connectionManager is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.connectionManager = connectionManager;
        this.logger = logger;
    }

    /**
     * Obtiene una conexión activa por su clientId
     *
     * @param {string} clientId - ID del cliente/conexión
     * @returns {Promise<Object|null>} - Conexión activa o null si no existe
     */
    async getActiveConnection(clientId) {
        try {
            this.logger.debug('WhatsAppConnectionPortImpl', 'Getting active connection', { clientId });

            const connection = this.connectionManager.getConnection(clientId);

            if (!connection) {
                this.logger.warn('WhatsAppConnectionPortImpl', 'Connection not found', { clientId });
                return null;
            }

            return {
                clientId: connection.clientId || clientId,
                strategy: connection.strategy,
                isActive: connection.isActive || !!connection.strategy,
                isReady: connection.strategy?.isReady() || false,
                connectionData: connection
            };

        } catch (error) {
            this.logger.error('WhatsAppConnectionPortImpl', 'Error getting active connection', error, { clientId });
            throw new Error(`Failed to get connection: ${error.message}`);
        }
    }

    /**
     * Verifica si una conexión está disponible y lista para enviar mensajes
     *
     * @param {string} clientId - ID del cliente/conexión
     * @returns {Promise<boolean>} - true si está disponible, false en caso contrario
     */
    async isConnectionAvailable(clientId) {
        try {
            const connection = await this.getActiveConnection(clientId);

            if (!connection) {
                return false;
            }

            // Verificar que tenga estrategia y esté lista
            const isReady = connection.strategy &&
                           typeof connection.strategy.isReady === 'function' &&
                           connection.strategy.isReady();

            this.logger.debug('WhatsAppConnectionPortImpl', 'Connection availability checked', {
                clientId,
                isReady,
                hasStrategy: !!connection.strategy
            });

            return isReady;

        } catch (error) {
            this.logger.error('WhatsAppConnectionPortImpl', 'Error checking connection availability', error, { clientId });
            return false;
        }
    }

    /**
     * Obtiene información de una conexión por ID
     *
     * @param {string} connectionId - ID de la conexión en base de datos
     * @returns {Promise<Object|null>} - Datos de conexión o null
     */
    async getConnectionById(connectionId) {
        try {
            this.logger.debug('WhatsAppConnectionPortImpl', 'Getting connection by ID', { connectionId });

            // El connectionManager usa clientId, pero puede recibir el ID de BD
            // Necesitamos mapear desde la BD si es necesario
            const connection = this.connectionManager.getConnection(connectionId);

            if (!connection) {
                return null;
            }

            return {
                id: connectionId,
                clientId: connection.clientId || connectionId,
                status: connection.status || 'unknown',
                strategy: connection.strategy,
                lastSeen: connection.lastSeen || null
            };

        } catch (error) {
            this.logger.error('WhatsAppConnectionPortImpl', 'Error getting connection by ID', error, { connectionId });
            throw new Error(`Failed to get connection by ID: ${error.message}`);
        }
    }

    /**
     * Envía un mensaje a través de la conexión especificada
     *
     * @param {string} clientId - ID del cliente/conexión
     * @param {Object} messageData - Datos del mensaje a enviar
     * @param {string} messageData.phoneNumber - Número de teléfono destino
     * @param {string} messageData.content - Contenido del mensaje
     * @param {string} messageData.messageType - Tipo de mensaje (text, image, etc.)
     * @param {number} messageData.advisorId - ID del asesor que envía
     * @returns {Promise<Object>} - Mensaje enviado con metadata
     */
    async sendMessage(clientId, messageData) {
        try {
            this.logger.info('WhatsAppConnectionPortImpl', 'Sending message via connection', {
                clientId,
                phoneNumber: messageData.phoneNumber,
                messageType: messageData.messageType
            });

            const connection = await this.getActiveConnection(clientId);

            if (!connection || !connection.strategy) {
                throw new Error(`No active connection found for clientId: ${clientId}`);
            }

            // Formatear número de teléfono para WhatsApp
            const formattedPhone = messageData.phoneNumber.includes('@c.us')
                ? messageData.phoneNumber
                : `${messageData.phoneNumber}@c.us`;

            // Enviar mensaje usando el método sendMessageAndUpdate de la estrategia
            const sentMessage = await connection.strategy.sendMessageAndUpdate(
                formattedPhone,
                messageData.content,
                messageData.messageType || 'text',
                messageData.advisorId
            );

            this.logger.info('WhatsAppConnectionPortImpl', 'Message sent successfully', {
                clientId,
                messageId: sentMessage?.id,
                phoneNumber: messageData.phoneNumber
            });

            return sentMessage;

        } catch (error) {
            this.logger.error('WhatsAppConnectionPortImpl', 'Error sending message', error, {
                clientId,
                phoneNumber: messageData.phoneNumber
            });
            throw new Error(`Failed to send message: ${error.message}`);
        }
    }

    /**
     * Obtiene el estado de una conexión
     *
     * @param {string} clientId - ID del cliente/conexión
     * @returns {Promise<Object>} - Estado de la conexión
     */
    async getConnectionStatus(clientId) {
        try {
            const connection = await this.getActiveConnection(clientId);

            if (!connection) {
                return {
                    clientId,
                    status: 'disconnected',
                    isReady: false,
                    hasStrategy: false
                };
            }

            return {
                clientId,
                status: connection.isReady ? 'connected' : 'connecting',
                isReady: connection.isReady,
                hasStrategy: !!connection.strategy,
                connectionData: {
                    isActive: connection.isActive
                }
            };

        } catch (error) {
            this.logger.error('WhatsAppConnectionPortImpl', 'Error getting connection status', error, { clientId });
            return {
                clientId,
                status: 'error',
                isReady: false,
                hasStrategy: false,
                error: error.message
            };
        }
    }
}

module.exports = WhatsAppConnectionPortImpl;