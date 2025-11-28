const LoggerPort = require('../../../../application/ports/output/LoggerPort');
const structuredLogger = require('../../../config/StructuredLogger');

/**
 * Adaptador del logger estructurado que implementa el puerto LoggerPort
 * Esta clase pertenece a la capa de infraestructura y adapta el logger concreto
 */
class StructuredLoggerAdapter extends LoggerPort {
    info(service, message, metadata = {}) {
        structuredLogger.info(service, message, metadata);
    }

    error(service, message, error, metadata = {}) {
        structuredLogger.error(service, message, error, metadata);
    }

    warn(service, message, metadata = {}) {
        structuredLogger.warn(service, message, metadata);
    }

    debug(service, message, metadata = {}) {
        structuredLogger.debug(service, message, metadata);
    }

    performance(service, operation, duration, metadata = {}) {
        structuredLogger.performance(service, operation, duration, metadata);
    }
}

module.exports = StructuredLoggerAdapter;