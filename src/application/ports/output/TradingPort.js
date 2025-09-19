/**
 * Puerto de salida para operaciones de trading
 * Sigue la arquitectura hexagonal - Capa de aplicación
 * Define el contrato que deben implementar los adaptadores de infraestructura
 */
class TradingPort {
    /**
     * Obtiene el tipo de cambio entre dos monedas
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<number>} Tipo de cambio
     * @throws {Error} Si no se puede obtener el tipo de cambio
     */
    async getExchangeRate(currencyBase, currencyQuote) {
        throw new Error('getExchangeRate method must be implemented');
    }

    /**
     * Obtiene información histórica de tipos de cambio
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @param {Date} startDate - Fecha de inicio
     * @param {Date} endDate - Fecha de fin
     * @returns {Promise<Array>} Historial de tipos de cambio
     * @throws {Error} Si no se puede obtener el historial
     */
    async getExchangeRateHistory(currencyBase, currencyQuote, startDate, endDate) {
        throw new Error('getExchangeRateHistory method must be implemented');
    }

    /**
     * Obtiene las monedas disponibles para trading
     * @returns {Promise<Array>} Lista de monedas disponibles
     * @throws {Error} Si no se pueden obtener las monedas
     */
    async getAvailableCurrencies() {
        throw new Error('getAvailableCurrencies method must be implemented');
    }

    /**
     * Valida si un par de monedas es válido para trading
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<boolean>} True si el par es válido
     * @throws {Error} Si no se puede validar el par
     */
    async isValidTradingPair(currencyBase, currencyQuote) {
        throw new Error('isValidTradingPair method must be implemented');
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

    /**
     * Obtiene precio de trading desde proveedor externo (e.g., Binance)
     * @param {Object} params - { typeTrade, currencyBase, currencyQuote, amountQuote, optionsTypePay }
     * @returns {Promise<{ price: number }>} Resultado del precio de trading
     */
    async getTradingPrice(params) {
        throw new Error('getTradingPrice method must be implemented');
    }
}

module.exports = TradingPort; 