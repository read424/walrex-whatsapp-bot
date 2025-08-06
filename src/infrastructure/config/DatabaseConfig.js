const env = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: `.env.${env}`});
const structuredLogger = require('./StructuredLogger');

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_DATABASE, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
    host:  process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    timezone: '-05:00',
    logging: (msg) => structuredLogger.info('DatabaseConfig', msg),
});

module.exports = sequelize;