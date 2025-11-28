/**
 * Puerto de salida (output port) para conexiones de WhatsApp
 *
 * Define el contrato que debe cumplir cualquier Strategy de conexión WhatsApp.
 * Esto permite cambiar de librería (whatsapp-web.js, Baileys, etc.) sin afectar
 * la lógica de aplicación.
 *
 * PATRÓN STRATEGY: Este puerto define la interfaz común para todas las estrategias
 * de conexión de WhatsApp.
 */
class WhatsAppConnectionPort {
    /**
     * Inicializa la conexión de WhatsApp
     * @returns {Promise<void>}
     */
    async init() {
        throw new Error('Method init() must be implemented by Strategy');
    }

    /**
     * Envía un mensaje de texto
     * @param {string} number - Número de destino
     * @param {string} message - Mensaje a enviar
     * @returns {Promise<Object>} - Mensaje enviado
     */
    async sendMessage(number, message) {
        throw new Error('Method sendMessage() must be implemented by Strategy');
    }

    /**
     * Envía un mensaje con media (imagen, video, documento)
     * @param {string} number - Número de destino
     * @param {Object} media - Media a enviar
     * @returns {Promise<Object>} - Mensaje enviado
     */
    async sendMessageMedia(number, media) {
        throw new Error('Method sendMessageMedia() must be implemented by Strategy');
    }

    /**
     * Envía botones interactivos
     * @param {string} number - Número de destino
     * @param {string} message - Mensaje
     * @param {Array} buttons - Botones
     * @param {string} footer - Footer opcional
     * @returns {Promise<Object>} - Mensaje enviado
     */
    async sendButtons(number, message, buttons, footer) {
        throw new Error('Method sendButtons() must be implemented by Strategy');
    }

    /**
     * Obtiene el código QR actual (si está disponible)
     * @returns {string|null} - Código QR o null
     */
    getQRCode() {
        throw new Error('Method getQRCode() must be implemented by Strategy');
    }

    /**
     * Verifica si el cliente está listo
     * @returns {boolean}
     */
    isReady() {
        throw new Error('Method isReady() must be implemented by Strategy');
    }

    /**
     * Obtiene el estado actual de la conexión
     * @returns {Object} - Estado de conexión
     */
    getConnectionState() {
        throw new Error('Method getConnectionState() must be implemented by Strategy');
    }

    /**
     * Reinicia la conexión
     * @returns {Promise<void>}
     */
    async restartConnection() {
        throw new Error('Method restartConnection() must be implemented by Strategy');
    }

    /**
     * Cierra la sesión
     * @returns {Promise<void>}
     */
    async logout() {
        throw new Error('Method logout() must be implemented by Strategy');
    }

    /**
     * Limpia recursos y cierra conexión
     * @returns {Promise<void>}
     */
    async cleanup() {
        throw new Error('Method cleanup() must be implemented by Strategy');
    }

    /**
     * Establece un callback para recibir mensajes
     * @param {Function} callback - Función a llamar cuando llega un mensaje
     * @returns {Promise<void>}
     */
    async onMessage(callback) {
        throw new Error('Method onMessage() must be implemented by Strategy');
    }
}

module.exports = WhatsAppConnectionPort;
