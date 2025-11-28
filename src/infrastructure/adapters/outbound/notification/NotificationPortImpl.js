const NotificationPort = require('../../../../application/ports/output/NotificationPort');

/**
 * Implementación del puerto NotificationPort usando WebSocket
 *
 * Este adaptador conecta la capa de aplicación con el sistema de WebSocket existente.
 * Es el puente entre los casos de uso (que dependen del puerto abstracto) y
 * la implementación concreta del adaptador de WebSocket.
 *
 * Responsabilidades:
 * - Traducir llamadas del puerto a eventos de WebSocket
 * - Notificar actualizaciones en tiempo real a los clientes conectados
 * - Gestionar el targeting de notificaciones (por tenant, usuario, etc.)
 */
class NotificationPortImpl extends NotificationPort {
    /**
     * @param {Object} webSocketAdapter - Adaptador de WebSocket existente
     * @param {Object} logger - Adaptador de logging
     */
    constructor(webSocketAdapter, logger) {
        super();

        if (!webSocketAdapter) {
            throw new Error('webSocketAdapter is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.webSocketAdapter = webSocketAdapter;
        this.logger = logger;
    }

    /**
     * Notifica la actualización de una sesión de chat
     *
     * @param {string|number} tenantId - ID del tenant
     * @param {number} sessionId - ID de la sesión actualizada
     * @param {Object} updates - Campos actualizados
     * @returns {Promise<void>}
     */
    async notifySessionUpdate(tenantId, sessionId, updates) {
        try {
            this.logger.debug('NotificationPortImpl', 'Notifying session update', {
                tenantId,
                sessionId,
                updateKeys: Object.keys(updates)
            });

            this.webSocketAdapter.emitToTenant(tenantId, 'sessionUpdated', {
                sessionId,
                updates,
                timestamp: new Date().toISOString()
            });

            this.logger.info('NotificationPortImpl', 'Session update notified successfully', {
                tenantId,
                sessionId
            });

        } catch (error) {
            this.logger.error('NotificationPortImpl', 'Error notifying session update', error, {
                tenantId,
                sessionId
            });
            // No lanzar error - las notificaciones son best-effort
        }
    }

    /**
     * Notifica un nuevo mensaje en una sesión
     *
     * @param {string|number} tenantId - ID del tenant
     * @param {Object} message - Mensaje enviado/recibido
     * @returns {Promise<void>}
     */
    async notifyNewMessage(tenantId, message) {
        try {
            this.logger.debug('NotificationPortImpl', 'Notifying new message', {
                tenantId,
                messageId: message.id,
                sessionId: message.sessionId
            });

            this.webSocketAdapter.emitToTenant(tenantId, 'newMessage', {
                message,
                timestamp: new Date().toISOString()
            });

            this.logger.info('NotificationPortImpl', 'New message notified successfully', {
                tenantId,
                messageId: message.id
            });

        } catch (error) {
            this.logger.error('NotificationPortImpl', 'Error notifying new message', error, {
                tenantId,
                messageId: message?.id
            });
            // No lanzar error - las notificaciones son best-effort
        }
    }

    /**
     * Notifica la creación de una nueva sesión de chat
     *
     * @param {string|number} tenantId - ID del tenant
     * @param {Object} session - Sesión creada
     * @returns {Promise<void>}
     */
    async notifyNewSession(tenantId, session) {
        try {
            this.logger.debug('NotificationPortImpl', 'Notifying new session', {
                tenantId,
                sessionId: session.id
            });

            this.webSocketAdapter.emitToTenant(tenantId, 'newSession', {
                session,
                timestamp: new Date().toISOString()
            });

            this.logger.info('NotificationPortImpl', 'New session notified successfully', {
                tenantId,
                sessionId: session.id
            });

        } catch (error) {
            this.logger.error('NotificationPortImpl', 'Error notifying new session', error, {
                tenantId,
                sessionId: session?.id
            });
            // No lanzar error - las notificaciones son best-effort
        }
    }

    /**
     * Notifica a un usuario específico
     *
     * @param {string|number} userId - ID del usuario
     * @param {string} eventType - Tipo de evento
     * @param {Object} data - Datos del evento
     * @returns {Promise<void>}
     */
    async notifyUser(userId, eventType, data) {
        try {
            this.logger.debug('NotificationPortImpl', 'Notifying user', {
                userId,
                eventType
            });

            // Si el webSocketAdapter tiene método para notificar a usuario específico
            if (typeof this.webSocketAdapter.emitToUser === 'function') {
                this.webSocketAdapter.emitToUser(userId, eventType, {
                    ...data,
                    timestamp: new Date().toISOString()
                });
            } else {
                this.logger.warn('NotificationPortImpl', 'emitToUser not available in webSocketAdapter', {
                    userId,
                    eventType
                });
            }

        } catch (error) {
            this.logger.error('NotificationPortImpl', 'Error notifying user', error, {
                userId,
                eventType
            });
            // No lanzar error - las notificaciones son best-effort
        }
    }

    /**
     * Notifica a todos los usuarios de un tenant
     *
     * @param {string|number} tenantId - ID del tenant
     * @param {string} eventType - Tipo de evento
     * @param {Object} data - Datos del evento
     * @returns {Promise<void>}
     */
    async notifyTenant(tenantId, eventType, data) {
        try {
            this.logger.debug('NotificationPortImpl', 'Notifying tenant', {
                tenantId,
                eventType
            });

            this.webSocketAdapter.emitToTenant(tenantId, eventType, {
                ...data,
                timestamp: new Date().toISOString()
            });

            this.logger.info('NotificationPortImpl', 'Tenant notified successfully', {
                tenantId,
                eventType
            });

        } catch (error) {
            this.logger.error('NotificationPortImpl', 'Error notifying tenant', error, {
                tenantId,
                eventType
            });
            // No lanzar error - las notificaciones son best-effort
        }
    }
}

module.exports = NotificationPortImpl;