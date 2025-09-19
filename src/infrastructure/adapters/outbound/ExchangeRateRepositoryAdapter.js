const structuredLogger = require('../../config/StructuredLogger');
const { PriceExchange, Currency } = require('../../../models');

/**
 * Adaptador de repositorio para tipos de cambio
 * Sigue la arquitectura hexagonal - Capa de infraestructura
 * Implementa ExchangeRateRepositoryPort usando Sequelize
 */
class ExchangeRateRepositoryAdapter {
    constructor() {
        this.CACHE_DURATION_MINUTES = 5; // Cache de 5 minutos
    }

    /**
     * Obtiene el tipo de cambio más reciente de la base de datos
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<Object|null>} Tipo de cambio o null si no existe
     */
    async getLatestExchangeRate(currencyBase, currencyQuote) {
        try {
            structuredLogger.info('ExchangeRateRepositoryAdapter', 'Getting latest exchange rate from DB', {
                currencyBase,
                currencyQuote
            });

            // Obtener IDs de las monedas
            const baseCurrency = await Currency.findOne({
                where: { code: currencyBase }
            });

            const quoteCurrency = await Currency.findOne({
                where: { code: currencyQuote }
            });

            if (!baseCurrency || !quoteCurrency) {
                structuredLogger.warn('ExchangeRateRepositoryAdapter', 'Currency not found', {
                    currencyBase,
                    currencyQuote,
                    baseCurrencyFound: !!baseCurrency,
                    quoteCurrencyFound: !!quoteCurrency
                });
                return null;
            }

            // Buscar el tipo de cambio más reciente
            const exchangeRate = await PriceExchange.findOne({
                where: {
                    id_currency_base: baseCurrency.id,
                    id_currency_quote: quoteCurrency.id,
                    is_active: '1'
                },
                order: [['date_exchange', 'DESC']],
                include: [
                    {
                        model: Currency,
                        as: 'baseCurrency',
                        attributes: ['code', 'name']
                    },
                    {
                        model: Currency,
                        as: 'quoteCurrency',
                        attributes: ['code', 'name']
                    }
                ]
            });

            if (!exchangeRate) {
                structuredLogger.info('ExchangeRateRepositoryAdapter', 'No exchange rate found in DB', {
                    currencyBase,
                    currencyQuote
                });
                return null;
            }

            const result = {
                id: exchangeRate.id,
                currencyBase: exchangeRate.baseCurrency.code,
                currencyQuote: exchangeRate.quoteCurrency.code,
                rate: exchangeRate.amount_price,
                dateExchange: exchangeRate.date_exchange,
                timestamp: exchangeRate.create_at
            };

            structuredLogger.info('ExchangeRateRepositoryAdapter', 'Latest exchange rate retrieved from DB', {
                currencyBase,
                currencyQuote,
                rate: result.rate,
                dateExchange: result.dateExchange
            });

            return result;

        } catch (error) {
            structuredLogger.error('ExchangeRateRepositoryAdapter', 'Error getting latest exchange rate', error, {
                currencyBase,
                currencyQuote
            });
            throw error;
        }
    }

    /**
     * Guarda un nuevo tipo de cambio en la base de datos
     * @param {Object} exchangeRateData - Datos del tipo de cambio
     * @returns {Promise<Object>} Tipo de cambio guardado
     */
    async saveExchangeRate(exchangeRateData) {
        try {
            structuredLogger.info('ExchangeRateRepositoryAdapter', 'Saving exchange rate to DB', {
                currencyBase: exchangeRateData.currencyBase,
                currencyQuote: exchangeRateData.currencyQuote,
                rate: exchangeRateData.rate
            });

            // Obtener IDs de las monedas
            const baseCurrency = await Currency.findOne({
                where: { code: exchangeRateData.currencyBase }
            });

            const quoteCurrency = await Currency.findOne({
                where: { code: exchangeRateData.currencyQuote }
            });

            if (!baseCurrency || !quoteCurrency) {
                throw new Error(`Monedas no encontradas: ${exchangeRateData.currencyBase} o ${exchangeRateData.currencyQuote}`);
            }

            // Crear nuevo registro de tipo de cambio
            const newExchangeRate = await PriceExchange.create({
                type_operation: 'E', // Exchange
                id_currency_base: baseCurrency.id,
                id_currency_quote: quoteCurrency.id,
                amount_price: exchangeRateData.rate,
                is_active: '1',
                date_exchange: new Date().toISOString().split('T')[0], // Solo la fecha
                create_at: new Date(),
                update_at: new Date()
            });

            const result = {
                id: newExchangeRate.id,
                currencyBase: exchangeRateData.currencyBase,
                currencyQuote: exchangeRateData.currencyQuote,
                rate: newExchangeRate.amount_price,
                dateExchange: newExchangeRate.date_exchange,
                timestamp: newExchangeRate.create_at
            };

            structuredLogger.info('ExchangeRateRepositoryAdapter', 'Exchange rate saved to DB', {
                id: result.id,
                currencyBase: result.currencyBase,
                currencyQuote: result.currencyQuote,
                rate: result.rate
            });

            return result;

        } catch (error) {
            structuredLogger.error('ExchangeRateRepositoryAdapter', 'Error saving exchange rate', error, {
                currencyBase: exchangeRateData?.currencyBase,
                currencyQuote: exchangeRateData?.currencyQuote,
                rate: exchangeRateData?.rate
            });
            throw error;
        }
    }

    /**
     * Obtiene el historial de tipos de cambio de la base de datos
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @param {Date} startDate - Fecha de inicio
     * @param {Date} endDate - Fecha de fin
     * @returns {Promise<Array>} Historial de tipos de cambio
     */
    async getExchangeRateHistory(currencyBase, currencyQuote, startDate, endDate) {
        try {
            structuredLogger.info('ExchangeRateRepositoryAdapter', 'Getting exchange rate history from DB', {
                currencyBase,
                currencyQuote,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });

            // Obtener IDs de las monedas
            const baseCurrency = await Currency.findOne({
                where: { code: currencyBase }
            });

            const quoteCurrency = await Currency.findOne({
                where: { code: currencyQuote }
            });

            if (!baseCurrency || !quoteCurrency) {
                return [];
            }

            // Buscar historial
            const history = await PriceExchange.findAll({
                where: {
                    id_currency_base: baseCurrency.id,
                    id_currency_quote: quoteCurrency.id,
                    is_active: '1',
                    date_exchange: {
                        [require('sequelize').Op.between]: [
                            startDate.toISOString().split('T')[0],
                            endDate.toISOString().split('T')[0]
                        ]
                    }
                },
                order: [['date_exchange', 'ASC']],
                include: [
                    {
                        model: Currency,
                        as: 'baseCurrency',
                        attributes: ['code', 'name']
                    },
                    {
                        model: Currency,
                        as: 'quoteCurrency',
                        attributes: ['code', 'name']
                    }
                ]
            });

            const result = history.map(record => ({
                id: record.id,
                currencyBase: record.baseCurrency.code,
                currencyQuote: record.quoteCurrency.code,
                rate: record.amount_price,
                dateExchange: record.date_exchange,
                timestamp: record.create_at
            }));

            structuredLogger.info('ExchangeRateRepositoryAdapter', 'Exchange rate history retrieved from DB', {
                currencyBase,
                currencyQuote,
                recordCount: result.length
            });

            return result;

        } catch (error) {
            structuredLogger.error('ExchangeRateRepositoryAdapter', 'Error getting exchange rate history', error, {
                currencyBase,
                currencyQuote,
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString()
            });
            throw error;
        }
    }

    /**
     * Verifica si existe un tipo de cambio reciente (menos de 5 minutos)
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<boolean>} True si existe un tipo de cambio reciente
     */
    async hasRecentExchangeRate(currencyBase, currencyQuote) {
        try {
            const fiveMinutesAgo = new Date(Date.now() - (this.CACHE_DURATION_MINUTES * 60 * 1000));

            // Obtener IDs de las monedas
            const baseCurrency = await Currency.findOne({
                where: { code: currencyBase }
            });

            const quoteCurrency = await Currency.findOne({
                where: { code: currencyQuote }
            });

            if (!baseCurrency || !quoteCurrency) {
                return false;
            }

            // Verificar si existe un registro reciente
            const recentRate = await PriceExchange.findOne({
                where: {
                    id_currency_base: baseCurrency.id,
                    id_currency_quote: quoteCurrency.id,
                    is_active: '1',
                    create_at: {
                        [require('sequelize').Op.gte]: fiveMinutesAgo
                    }
                }
            });

            const hasRecent = !!recentRate;

            structuredLogger.info('ExchangeRateRepositoryAdapter', 'Checking for recent exchange rate', {
                currencyBase,
                currencyQuote,
                hasRecent,
                cacheDurationMinutes: this.CACHE_DURATION_MINUTES
            });

            return hasRecent;

        } catch (error) {
            structuredLogger.error('ExchangeRateRepositoryAdapter', 'Error checking recent exchange rate', error, {
                currencyBase,
                currencyQuote
            });
            return false;
        }
    }

    /**
     * Obtiene las monedas disponibles desde la base de datos
     * @returns {Promise<Array>} Lista de monedas disponibles
     */
    async getAvailableCurrencies() {
        try {
            structuredLogger.info('ExchangeRateRepositoryAdapter', 'Getting available currencies from DB');

            const currencies = await Currency.findAll({
                where: { is_active: '1' },
                attributes: ['code', 'name'],
                order: [['code', 'ASC']]
            });

            const result = currencies.map(currency => ({
                code: currency.code,
                name: currency.name
            }));

            structuredLogger.info('ExchangeRateRepositoryAdapter', 'Available currencies retrieved from DB', {
                currencyCount: result.length
            });

            return result;

        } catch (error) {
            structuredLogger.error('ExchangeRateRepositoryAdapter', 'Error getting available currencies', error);
            throw error;
        }
    }

    /**
     * Obtiene el precio de trading para un par de monedas en una fecha específica
     * @param {Date} dateExchange - Fecha de cambio
     * @param {string} currencyBaseCode - Código ISO 4217 de la moneda base
     * @param {string} currencyQuoteCode - Código ISO 4217 de la moneda cotizada
     * @returns {Promise<number>} Precio de trading (mount_price)
     * @throws {Error} Si no existe tasa de cambio para los parámetros dados
     */
    async getTradePrice(dateExchange, currencyBaseCode, currencyQuoteCode) {
        try {
            structuredLogger.info('ExchangeRateRepositoryAdapter', 'Getting trade price from DB', {
                dateExchange: dateExchange.toISOString(),
                currencyBaseCode,
                currencyQuoteCode
            });

            // Convertir la fecha a formato YYYY-MM-DD
            const dateString = dateExchange.toISOString().split('T')[0];

            // Ejecutar la consulta SQL usando Sequelize
            const result = await PriceExchange.findOne({
                attributes: ['amount_price'],
                include: [
                    {
                        model: Currency,
                        as: 'baseCurrency',
                        attributes: [],
                        where: { code_iso3: currencyBaseCode }
                    },
                    {
                        model: Currency,
                        as: 'quoteCurrency',
                        attributes: [],
                        where: { code_iso3: currencyQuoteCode }
                    }
                ],
                where: {
                    is_active: '1',
                    type_operation: '3',
                    date_exchange: dateString
                },
                raw: false
            });

            if (!result) {
                const errorMessage = `No existe tasa de cambio para ${currencyBaseCode}/${currencyQuoteCode} en la fecha ${dateString}`;
                structuredLogger.warn('ExchangeRateRepositoryAdapter', errorMessage, {
                    dateExchange: dateString,
                    currencyBaseCode,
                    currencyQuoteCode
                });
                throw new Error(errorMessage);
            }

            const tradePrice = result.amount_price;

            structuredLogger.info('ExchangeRateRepositoryAdapter', 'Trade price retrieved successfully', {
                dateExchange: dateString,
                currencyBaseCode,
                currencyQuoteCode,
                tradePrice
            });

            return tradePrice;

        } catch (error) {
            structuredLogger.error('ExchangeRateRepositoryAdapter', 'Error getting trade price', error, {
                dateExchange: dateExchange?.toISOString(),
                currencyBaseCode,
                currencyQuoteCode
            });
            throw error;
        }
    }
}

module.exports = ExchangeRateRepositoryAdapter; 