/**
 * Puerto de salida para repositorio de tipos de cambio
 * Sigue la arquitectura hexagonal - Capa de aplicación
 * Define el contrato para acceso a datos de tipos de cambio
 */
class ExchangeRateRepositoryPort {
    /**
     * Obtiene el tipo de cambio más reciente de la base de datos
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<Object|null>} Tipo de cambio o null si no existe
     * @throws {Error} Si no se puede acceder a la base de datos
     */
    async getLatestExchangeRate(currencyBase, currencyQuote) {
        throw new Error('getLatestExchangeRate method must be implemented');
    }

    /**
     * Guarda un nuevo tipo de cambio en la base de datos
     * @param {Object} exchangeRateData - Datos del tipo de cambio
     * @param {string} exchangeRateData.currencyBase - Moneda base
     * @param {string} exchangeRateData.currencyQuote - Moneda cotizada
     * @param {number} exchangeRateData.rate - Tipo de cambio
     * @param {Date} exchangeRateData.timestamp - Timestamp del tipo de cambio
     * @returns {Promise<Object>} Tipo de cambio guardado
     * @throws {Error} Si no se puede guardar en la base de datos
     */
    async saveExchangeRate(exchangeRateData) {
        throw new Error('saveExchangeRate method must be implemented');
    }

    /**
     * Obtiene el historial de tipos de cambio de la base de datos
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @param {Date} startDate - Fecha de inicio
     * @param {Date} endDate - Fecha de fin
     * @returns {Promise<Array>} Historial de tipos de cambio
     * @throws {Error} Si no se puede acceder a la base de datos
     */
    async getExchangeRateHistory(currencyBase, currencyQuote, startDate, endDate) {
        throw new Error('getExchangeRateHistory method must be implemented');
    }

    /**
     * Verifica si existe un tipo de cambio reciente (menos de 5 minutos)
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<boolean>} True si existe un tipo de cambio reciente
     * @throws {Error} Si no se puede verificar en la base de datos
     */
    async hasRecentExchangeRate(currencyBase, currencyQuote) {
        throw new Error('hasRecentExchangeRate method must be implemented');
    }

    /**
     * Obtiene las monedas disponibles desde la base de datos
     * @returns {Promise<Array>} Lista de monedas disponibles
     * @throws {Error} Si no se puede acceder a la base de datos
     */
    async getAvailableCurrencies() {
        throw new Error('getAvailableCurrencies method must be implemented');
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
        throw new Error('getTradePrice method must be implemented');
    }
}

module.exports = ExchangeRateRepositoryPort; 