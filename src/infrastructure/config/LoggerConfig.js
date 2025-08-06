const { createLogger, format, transports } = require('winston');
const {combine, timestamp, printf, colorize, label } = format;
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logFormat = printf(( {level, message, timestamp, label }) => {
    return `${timestamp} [${label}] [${level}]: ${message}`;
});


const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { 
        serviceName: 'express-logging-service',
        buildDetails: {
            nodeVersion: process.version,
            commitHash: process.env.COMMIT_HASH || 'local',
            appVersion: process.env.APP_VERSION || '1.0.0'
        } 
    },
    format: combine(
        colorize(),
        label({ label: 'MAIN' }),
        timestamp( {format: 'YYYY-MM-DD HH:mm:ss'} ),
        logFormat
    ),
    transports: [
        // Transporte para archivos de error
        new DailyRotateFile({
            filename: 'error-%DATE%.log',
            dirname: path.join(__dirname, '../logs'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
        }),
        new DailyRotateFile({
            filename: 'application-%DATE%.log',
            dirname: path.join(__dirname, '../logs'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
        }),
    ],
    exitOnError: false, //No salir despues de un error
});

if(process.env.NODE_ENV !== 'production'){
    logger.add(new transports.Console({
        format: combine(
            colorize(),
            logFormat
        )
    }));
}

const createModuleLogger = (moduleName) => {
    return createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: combine(
            label( {label: moduleName} ),
            timestamp( {format: 'YYYY-MM-DD HH:mm:ss'} ),
            logFormat
        ),
        transports: [
            new DailyRotateFile({
                filename: `${moduleName}-%DATE%.log`,
                dirname: path.join(__dirname, '../logs'),
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '20m',
                maxFiles: '14d'
            })
        ]
    });
};

module.exports = logger;
module.exports.createModuleLogger = createModuleLogger;