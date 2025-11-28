/**
 * Puerto (interfaz) para el servicio de Messenger
 * Define el contrato que debe cumplir cualquier implementación de mensajería de Facebook Messenger
 */
class MessengerPort {
    /**
     * Enviar mensaje de texto a un usuario
     * @param {string} recipientPsid - Page Scoped ID del destinatario
     * @param {string} text - Texto del mensaje
     * @returns {Promise<Object>} - Respuesta de la API de Facebook
     */
    async sendMessage(recipientPsid, text) {
        throw new Error('Method not implemented');
    }

    /**
     * Enviar mensaje con botones
     * @param {string} recipientPsid - Page Scoped ID del destinatario
     * @param {string} text - Texto del mensaje
     * @param {Array<Object>} buttons - Array de botones
     * @returns {Promise<Object>} - Respuesta de la API de Facebook
     */
    async sendButtonMessage(recipientPsid, text, buttons) {
        throw new Error('Method not implemented');
    }

    /**
     * Enviar imagen
     * @param {string} recipientPsid - Page Scoped ID del destinatario
     * @param {string} imageUrl - URL de la imagen
     * @returns {Promise<Object>} - Respuesta de la API de Facebook
     */
    async sendImage(recipientPsid, imageUrl) {
        throw new Error('Method not implemented');
    }

    /**
     * Marcar mensaje como visto
     * @param {string} recipientPsid - Page Scoped ID del destinatario
     * @returns {Promise<void>}
     */
    async markSeen(recipientPsid) {
        throw new Error('Method not implemented');
    }

    /**
     * Mostrar indicador de escritura
     * @param {string} recipientPsid - Page Scoped ID del destinatario
     * @returns {Promise<void>}
     */
    async sendTypingOn(recipientPsid) {
        throw new Error('Method not implemented');
    }

    /**
     * Apagar indicador de escritura
     * @param {string} recipientPsid - Page Scoped ID del destinatario
     * @returns {Promise<void>}
     */
    async sendTypingOff(recipientPsid) {
        throw new Error('Method not implemented');
    }
}

module.exports = MessengerPort;