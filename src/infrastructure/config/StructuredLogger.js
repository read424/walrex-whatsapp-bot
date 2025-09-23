const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, label, errors } = format;
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class StructuredLogger {
    constructor() {
        this.correlationId = null;
        this.loggers = new Map();
    }

    /**
     * Genera un nuevo correlation ID
     * @returns {string} - Correlation ID único
     */
    generateCorrelationId() {
        return uuidv4();
    }

    /**
     * Establece el correlation ID para la sesión actual
     * @param {string} correlationId - ID de correlación
     */
    setCorrelationId(correlationId) {
        this.correlationId = correlationId;
    }

    /**
     * Obtiene el correlation ID actual
     * @returns {string} - Correlation ID actual
     */
    getCorrelationId() {
        if (!this.correlationId) {
            this.correlationId = this.generateCorrelationId();
        }
        return this.correlationId;
    }

    /**
     * Formato personalizado para logs estructurados
     */
    getLogFormat() {
        return printf(({ level, message, timestamp, label, correlationId, userId, phoneNumber, action, duration, error, ...meta }) => {
            const baseLog = {
                timestamp,
                level: level.toUpperCase(),
                correlationId: correlationId || this.getCorrelationId(),
                message,
                module: label
            };

            // Agregar campos opcionales si existen
            if (userId) baseLog.userId = userId;
            if (phoneNumber) baseLog.phoneNumber = phoneNumber;
            if (action) baseLog.action = action;
            if (duration) baseLog.duration = `${duration}ms`;
            if (error) baseLog.error = error;
            if (Object.keys(meta).length > 0) baseLog.meta = meta;

            return JSON.stringify(baseLog);
        });
    }

    /**
     * Crea un logger para un módulo específico
     * @param {string} moduleName - Nombre del módulo
     * @returns {Object} - Logger configurado
     */
    createModuleLogger(moduleName) {
        if (this.loggers.has(moduleName)) {
            return this.loggers.get(moduleName);
        }

        const logger = createLogger({
            level: process.env.LOG_LEVEL || 'info',
            defaultMeta: {
                serviceName: 'whatsapp-bot',
                buildDetails: {
                    nodeVersion: process.version,
                    commitHash: process.env.COMMIT_HASH || 'local',
                    appVersion: process.env.APP_VERSION || '1.0.0'
                }
            },
            format: combine(
                errors({ stack: true }),
                label({ label: moduleName }),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                this.getLogFormat()
            ),
            transports: [
                // Transporte para archivos de error
                new DailyRotateFile({
                    filename: `error-${moduleName}-%DATE%.log`,
                    dirname: path.join(__dirname, '../logs'),
                    datePattern: 'YYYY-MM-DD',
                    level: 'error',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '14d'
                }),
                // Transporte para archivos de aplicación
                new DailyRotateFile({
                    filename: `application-${moduleName}-%DATE%.log`,
                    dirname: path.join(__dirname, '../logs'),
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '14d'
                })
            ],
            exitOnError: false
        });

        // Agregar transporte de consola en desarrollo
        if (process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV) {
            logger.add(new transports.Console({
                format: combine(
                    colorize(),
                    this.getLogFormat()
                )
            }));
        }

        this.loggers.set(moduleName, logger);
        return logger;
    }

    /**
     * Log de información con contexto
     * @param {string} moduleName - Nombre del módulo
     * @param {string} message - Mensaje
     * @param {Object} context - Contexto adicional
     */
    info(moduleName, message, context = {}) {
        const logger = this.createModuleLogger(moduleName);
        logger.info(message, {
            correlationId: this.getCorrelationId(),
            ...context
        });
    }

    /**
     * Log de error con contexto
     * @param {string} moduleName - Nombre del módulo
     * @param {string} message - Mensaje
     * @param {Error} error - Error
     * @param {Object} context - Contexto adicional
     */
    error(moduleName, message, error = null, context = {}) {
        const logger = this.createModuleLogger(moduleName);
        logger.error(message, {
            correlationId: this.getCorrelationId(),
            error: error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : null,
            ...context
        });
    }

    /**
     * Log de warning con contexto
     * @param {string} moduleName - Nombre del módulo
     * @param {string} message - Mensaje
     * @param {Object} context - Contexto adicional
     */
    warn(moduleName, message, context = {}) {
        const logger = this.createModuleLogger(moduleName);
        logger.warn(message, {
            correlationId: this.getCorrelationId(),
            ...context
        });
    }

    /**
     * Log de debug con contexto
     * @param {string} moduleName - Nombre del módulo
     * @param {string} message - Mensaje
     * @param {Object} context - Contexto adicional
     */
    debug(moduleName, message, context = {}) {
        const logger = this.createModuleLogger(moduleName);
        logger.debug(message, {
            correlationId: this.getCorrelationId(),
            ...context
        });
    }

    /**
     * Log de performance
     * @param {string} moduleName - Nombre del módulo
     * @param {string} action - Acción realizada
     * @param {number} duration - Duración en milisegundos
     * @param {Object} context - Contexto adicional
     */
    performance(moduleName, action, duration, context = {}) {
        const logger = this.createModuleLogger(moduleName);
        logger.info(`Performance: ${action}`, {
            correlationId: this.getCorrelationId(),
            action,
            duration,
            ...context
        });
    }

    /**
     * Log de métricas de negocio
     * @param {string} moduleName - Nombre del módulo
     * @param {string} metric - Nombre de la métrica
     * @param {any} value - Valor de la métrica
     * @param {Object} context - Contexto adicional
     */
    metric(moduleName, metric, value, context = {}) {
        const logger = this.createModuleLogger(moduleName);
        logger.info(`Metric: ${metric}`, {
            correlationId: this.getCorrelationId(),
            metric,
            value,
            ...context
        });
    }
}

// Singleton para el logger estructurado
const structuredLogger = new StructuredLogger();

module.exports = structuredLogger; 