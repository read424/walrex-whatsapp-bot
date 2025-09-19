const env = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: `.env.${env}`});
const structuredLogger = require('./StructuredLogger');

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_DATABASE, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
    host:  process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    dialectOptions:{
        // Configuraciones especificas para PostgreSQL
        supportBigNumbers: true,
        bigNumberStrings: true,
        // Para manejar campos JSONB correctamente
        useUTC: false,
        timezone: '-05:00'
    },
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    logging: (msg) => structuredLogger.info('DatabaseConfig', msg),
});

module.exports = sequelize;