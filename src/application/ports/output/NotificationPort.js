/**
 * Puerto (interfaz) para el servicio de notificaciones en tiempo real
 * Define el contrato que debe cumplir cualquier implementación de notificaciones (WebSocket, SSE, etc.)
 *
 * Este puerto abstrae el mecanismo de notificaciones, permitiendo que la capa de aplicación
 * no dependa de detalles de implementación específicos como WebSocket, Server-Sent Events, etc.
 */
class NotificationPort {
    /**
     * Notifica a todos los clientes de un tenant sobre una actualización de sesión
     * @param {number} tenantId - ID del tenant
     * @param {number} sessionId - ID de la sesión actualizada
     * @param {Object} updates - Datos de la actualización
     * @returns {Promise<void>}
     * @throws {Error} - Si el método no está implementado
     */
    async notifySessionUpdate(tenantId, sessionId, updates) {
        throw new Error('Method notifySessionUpdate not implemented');
    }

    /**
     * Notifica a todos los clientes de un tenant sobre un nuevo mensaje
     * @param {number} tenantId - ID del tenant
     * @param {Object} message - Datos del mensaje
     * @returns {Promise<void>}
     * @throws {Error} - Si el método no está implementado
     */
    async notifyNewMessage(tenantId, message) {
        throw new Error('Method notifyNewMessage not implemented');
    }

    /**
     * Notifica a todos los clientes de un tenant sobre una nueva sesión
     * @param {number} tenantId - ID del tenant
     * @param {Object} session - Datos de la sesión
     * @returns {Promise<void>}
     * @throws {Error} - Si el método no está implementado
     */
    async notifyNewSession(tenantId, session) {
        throw new Error('Method notifyNewSession not implemented');
    }

    /**
     * Notifica a un usuario específico
     * @param {number} userId - ID del usuario
     * @param {string} event - Nombre del evento
     * @param {Object} data - Datos del evento
     * @returns {Promise<void>}
     * @throws {Error} - Si el método no está implementado
     */
    async notifyUser(userId, event, data) {
        throw new Error('Method notifyUser not implemented');
    }

    /**
     * Notifica a todos los clientes de un tenant sobre un evento genérico
     * @param {number} tenantId - ID del tenant
     * @param {string} event - Nombre del evento
     * @param {Object} data - Datos del evento
     * @returns {Promise<void>}
     * @throws {Error} - Si el método no está implementado
     */
    async notifyTenant(tenantId, event, data) {
        throw new Error('Method notifyTenant not implemented');
    }

    /**
     * Emite un evento específico a todos los clientes de un tenant
     * Alias genérico para notifyTenant que coincide con la interfaz de webSocketAdapter
     * @param {number} tenantId - ID del tenant
     * @param {string} eventName - Nombre del evento
     * @param {Object} data - Datos del evento
     * @returns {Promise<void>}
     * @throws {Error} - Si el método no está implementado
     */
    async emitToTenant(tenantId, eventName, data) {
        throw new Error('Method emitToTenant not implemented');
    }
}

module.exports = NotificationPort;