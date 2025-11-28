/**
 * Manejador de sesiones de usuarios del bot WhatsApp
 * Responsabilidad: Gestionar el estado de las sesiones de conversación
 */

const UserSession = require('../../domain/model/UserSession');
const { normalizePhoneNumber } = require('../../utils/index');

class WhatsAppBotSessionManager {
    constructor() {
        this.sessions = {};
    }

    /**
     * Obtiene o crea una sesión para un número de teléfono
     * @param {string} phoneNumber - Número de teléfono
     * @returns {UserSession}
     */
    getSession(phoneNumber) {
        const normalized = normalizePhoneNumber(phoneNumber);

        if (!this.sessions[normalized]) {
            this.sessions[normalized] = new UserSession(normalized);
        }

        return this.sessions[normalized];
    }

    /**
     * Verifica si existe una sesión para un número
     * @param {string} phoneNumber - Número de teléfono
     * @returns {boolean}
     */
    hasSession(phoneNumber) {
        const normalized = normalizePhoneNumber(phoneNumber);
        return !!this.sessions[normalized];
    }

    /**
     * Elimina una sesión
     * @param {string} phoneNumber - Número de teléfono
     */
    clearSession(phoneNumber) {
        const normalized = normalizePhoneNumber(phoneNumber);
        delete this.sessions[normalized];
    }

    /**
     * Obtiene todas las sesiones activas
     * @returns {Object}
     */
    getAllSessions() {
        return this.sessions;
    }

    /**
     * Limpia todas las sesiones
     */
    clearAllSessions() {
        this.sessions = {};
    }

    /**
     * Obtiene el conteo de sesiones activas
     * @returns {number}
     */
    getSessionCount() {
        return Object.keys(this.sessions).length;
    }
}

module.exports = WhatsAppBotSessionManager;