const structuredLogger = require('../../../config/StructuredLogger');

/**
 * Middleware para manejar correlation IDs
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 */
function correlationMiddleware(req, res, next) {
    // Obtener correlation ID del header o generar uno nuevo
    const correlationId = req.headers['x-correlation-id'] || 
                         req.headers['correlation-id'] || 
                         structuredLogger.generateCorrelationId();

    // Establecer correlation ID en el logger
    structuredLogger.setCorrelationId(correlationId);

    // Agregar correlation ID al request para uso posterior
    req.correlationId = correlationId;

    // Agregar correlation ID a los headers de respuesta
    res.setHeader('x-correlation-id', correlationId);

    // Log de la petición entrante
    structuredLogger.info('HTTP_REQUEST', 'Incoming request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        correlationId
    });

    // Interceptar el final de la respuesta para logging
    const originalSend = res.send;
    res.send = function(data) {
        // Log de la respuesta
        structuredLogger.info('HTTP_RESPONSE', 'Outgoing response', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseSize: data ? JSON.stringify(data).length : 0,
            correlationId
        });

        // Llamar al método original
        return originalSend.call(this, data);
    };

    next();
}

module.exports = correlationMiddleware; 