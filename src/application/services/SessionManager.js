const structuredLogger = require('../../infrastructure/config/StructuredLogger');
const UserSession = require('../../domain/model/UserSession');
const { normalizePhoneNumber } = require('../../utils/index');

class SessionManager {
    constructor() {
        // Logger ya no necesario, usando structuredLogger directamente
        this.sessions = {};
    }

    /**
     * Obtiene o crea una sesión para un número de teléfono
     * @param {string} phoneNumber - Número de teléfono del usuario
     * @returns {UserSession} - Sesión del usuario
     */
    getSession(phoneNumber) {
        const startTime = Date.now();
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        
        if (!this.sessions[normalizedPhone]) {
            structuredLogger.info('SessionManager', 'Creating new session', {
                phoneNumber: normalizedPhone,
                action: 'create_session'
            });
            this.sessions[normalizedPhone] = new UserSession(normalizedPhone);
        }
        
        structuredLogger.performance('SessionManager', 'getSession', Date.now() - startTime, {
            phoneNumber: normalizedPhone,
            sessionExists: !!this.sessions[normalizedPhone]
        });
        
        return this.sessions[normalizedPhone];
    }

    /**
     * Verifica si existe una sesión para un número de teléfono
     * @param {string} phoneNumber - Número de teléfono del usuario
     * @returns {boolean} - True si existe la sesión
     */
    hasSession(phoneNumber) {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        return !!this.sessions[normalizedPhone];
    }

    /**
     * Elimina una sesión
     * @param {string} phoneNumber - Número de teléfono del usuario
     */
    removeSession(phoneNumber) {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        if (this.sessions[normalizedPhone]) {
            structuredLogger.info('SessionManager', 'Removing session', {
                phoneNumber: normalizedPhone,
                action: 'remove_session'
            });
            delete this.sessions[normalizedPhone];
        }
    }

    /**
     * Obtiene todas las sesiones activas
     * @returns {Object} - Objeto con todas las sesiones
     */
    getAllSessions() {
        return this.sessions;
    }

    /**
     * Limpia sesiones expiradas
     */
    cleanupExpiredSessions() {
        const now = new Date();
        Object.keys(this.sessions).forEach(phoneNumber => {
            const session = this.sessions[phoneNumber];
            // Aquí podrías agregar lógica para limpiar sesiones expiradas
            // Por ejemplo, sesiones que no han tenido actividad en X tiempo
        });
    }
}

module.exports = SessionManager; 