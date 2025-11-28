/**
 * Puerto (interfaz) para el servicio de logging
 * Define el contrato que debe cumplir cualquier implementación de logger
 */
class LoggerPort {
    /**
     * Registra un mensaje de información
     * @param {string} service - Nombre del servicio
     * @param {string} message - Mensaje a registrar
     * @param {Object} metadata - Metadatos adicionales
     */
    info(service, message, metadata = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Registra un mensaje de error
     * @param {string} service - Nombre del servicio
     * @param {string} message - Mensaje a registrar
     * @param {Error} error - Error object
     * @param {Object} metadata - Metadatos adicionales
     */
    error(service, message, error, metadata = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Registra un mensaje de advertencia
     * @param {string} service - Nombre del servicio
     * @param {string} message - Mensaje a registrar
     * @param {Object} metadata - Metadatos adicionales
     */
    warn(service, message, metadata = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Registra un mensaje de debug
     * @param {string} service - Nombre del servicio
     * @param {string} message - Mensaje a registrar
     * @param {Object} metadata - Metadatos adicionales
     */
    debug(service, message, metadata = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Registra métricas de rendimiento de una operación
     * @param {string} service - Nombre del servicio
     * @param {string} operation - Nombre de la operación
     * @param {number} duration - Duración en milisegundos
     * @param {Object} metadata - Metadatos adicionales
     */
    performance(service, operation, duration, metadata = {}) {
        throw new Error('Method not implemented');
    }
}

module.exports = LoggerPort;