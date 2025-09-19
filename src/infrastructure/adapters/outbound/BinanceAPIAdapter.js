const BinanceAPI = require("../../binance.api-v2");
const { BinanceApiPort } = require('../../../application/ports/output');

/**
 * Adaptador de Binance API que implementa BinanceApiPort
 * Sigue la arquitectura hexagonal - Capa de infraestructura
 * Utiliza la clase BinanceAPI existente para implementar el contrato
 */
class BinanceAPIAdapter extends BinanceApiPort {
    constructor() {
        super();
        this.api = new BinanceAPI();
    }

    /**
     * Obtiene el precio actual de un par de trading desde Binance
     * @param {string} symbol - Símbolo del par (ej: BTCUSDT, ETHUSDT)
     * @returns {Promise<number>} Precio actual
     */
    async getCurrentPrice(symbol) {
        try {
            // Extraer monedas del símbolo (ej: BTCUSDT -> BTC, USDT)
            const base = symbol.substring(0, 3);
            const quote = symbol.substring(3);
            
            // Usar el método existente de BinanceAPI
            const result = await this.api.getPriceTradingPair('BUY', base, quote, 100);
            
            if (result && result.price) {
                return parseFloat(result.price);
            }
            
            throw new Error(`No price data available for ${symbol}`);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Obtiene el precio de un par de monedas específico
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<number>} Precio actual
     */
    async getExchangeRate(currencyBase, currencyQuote) {
        try {
            // Usar el método existente de BinanceAPI
            const result = await this.api.getPriceTradingPair('BUY', currencyBase, currencyQuote, 100);
            
            if (result && result.price) {
                return parseFloat(result.price);
            }
            
            throw new Error(`No exchange rate available for ${currencyBase}/${currencyQuote}`);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Obtiene información histórica de precios desde Binance
     * @param {string} symbol - Símbolo del par
     * @param {string} interval - Intervalo de tiempo (1m, 5m, 15m, 1h, 4h, 1d)
     * @param {number} limit - Número de registros a obtener
     * @returns {Promise<Array>} Datos históricos
     */
    async getPriceHistory(symbol, interval, limit) {
        try {
            // Para P2P, simulamos historial basado en consultas múltiples
            const base = symbol.substring(0, 3);
            const quote = symbol.substring(3);
            
            // Hacer múltiples consultas para simular historial
            const history = [];
            for (let i = 0; i < Math.min(limit, 5); i++) {
                try {
                    const result = await this.api.getPriceTradingPair('BUY', base, quote, 100 + (i * 50));
                    if (result && result.price) {
                        history.push({
                            timestamp: new Date(Date.now() - (i * 60000)), // Simular timestamps
                            price: parseFloat(result.price),
                            volume: parseFloat(result.minSingleTransAmount || 0)
                        });
                    }
                } catch (error) {
                    // Continuar con la siguiente consulta
                    continue;
                }
            }
            
            return history;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Obtiene los símbolos disponibles en Binance
     * @returns {Promise<Array>} Lista de símbolos disponibles
     */
    async getAvailableSymbols() {
        try {
            // Retornar pares comunes disponibles basados en la implementación existente
            const commonPairs = [
                'USDTUSD', 'USDTEUR', 'USDTGBP', 'USDTJPY',
                'BTCUSD', 'ETHUSD', 'BNBUSD',
                'USDTVES', 'USDTCOP', 'USDTCLP', 'USDTPEN'
            ];
            
            return commonPairs;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Convierte un par de monedas ISO 4217 a símbolo de Binance
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {string} Símbolo de Binance
     */
    convertToBinanceSymbol(currencyBase, currencyQuote) {
        return `${currencyBase}${currencyQuote}`;
    }

    /**
     * Verifica si un par de monedas está disponible en Binance
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<boolean>} True si el par está disponible
     */
    async isSymbolAvailable(currencyBase, currencyQuote) {
        try {
            // Intentar obtener el precio para verificar disponibilidad
            const result = await this.api.getPriceTradingPair('BUY', currencyBase, currencyQuote, 100);
            return !!(result && result.price);
        } catch (error) {
            return false;
        }
    }

    /**
     * Método existente para compatibilidad
     * @param {string} type - Tipo de operación
     * @param {string} base - Moneda base
     * @param {string} quote - Moneda cotizada
     * @param {number} amount - Monto
     * @returns {Promise<Object>} Resultado del precio de trading
     */
    async getPriceTradingPair(type, base, quote, amount) {
        return this.api.getPriceTradingPair(type, base, quote, amount);
    }
}

module.exports = BinanceAPIAdapter;