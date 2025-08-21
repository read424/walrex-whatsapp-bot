/**
 * Puerto de salida para API de Binance
 * Sigue la arquitectura hexagonal - Capa de aplicación
 * Define el contrato para comunicación con Binance API
 */
class BinanceApiPort {
    /**
     * Obtiene el precio actual de un par de trading desde Binance
     * @param {string} symbol - Símbolo del par (ej: BTCUSDT, ETHUSDT)
     * @returns {Promise<number>} Precio actual
     * @throws {Error} Si no se puede obtener el precio de Binance
     */
    async getCurrentPrice(symbol) {
        throw new Error('getCurrentPrice method must be implemented');
    }

    /**
     * Obtiene el precio de un par de monedas específico
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<number>} Precio actual
     * @throws {Error} Si no se puede obtener el precio de Binance
     */
    async getExchangeRate(currencyBase, currencyQuote) {
        throw new Error('getExchangeRate method must be implemented');
    }

    /**
     * Obtiene información histórica de precios desde Binance
     * @param {string} symbol - Símbolo del par
     * @param {string} interval - Intervalo de tiempo (1m, 5m, 15m, 1h, 4h, 1d)
     * @param {number} limit - Número de registros a obtener
     * @returns {Promise<Array>} Datos históricos
     * @throws {Error} Si no se puede obtener el historial de Binance
     */
    async getPriceHistory(symbol, interval, limit) {
        throw new Error('getPriceHistory method must be implemented');
    }

    /**
     * Obtiene los símbolos disponibles en Binance
     * @returns {Promise<Array>} Lista de símbolos disponibles
     * @throws {Error} Si no se puede obtener la información de Binance
     */
    async getAvailableSymbols() {
        throw new Error('getAvailableSymbols method must be implemented');
    }

    /**
     * Convierte un par de monedas ISO 4217 a símbolo de Binance
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {string} Símbolo de Binance
     * @throws {Error} Si el par no es válido para Binance
     */
    convertToBinanceSymbol(currencyBase, currencyQuote) {
        throw new Error('convertToBinanceSymbol method must be implemented');
    }

    /**
     * Verifica si un par de monedas está disponible en Binance
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<boolean>} True si el par está disponible
     * @throws {Error} Si no se puede verificar en Binance
     */
    async isSymbolAvailable(currencyBase, currencyQuote) {
        throw new Error('isSymbolAvailable method must be implemented');
    }
}

module.exports = BinanceApiPort; 