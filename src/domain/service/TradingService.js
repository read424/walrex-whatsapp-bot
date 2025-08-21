const structuredLogger = require('../../infrastructure/config/StructuredLogger');

/**
 * Servicio de dominio para operaciones de trading
 * Sigue la arquitectura hexagonal - Capa de dominio
 * Contiene la lógica de negocio para cálculos de tipos de cambio
 */
class TradingService {
    constructor(tradingPort) {
        this.tradingPort = tradingPort;
    }

    /**
     * Obtiene el tipo de cambio entre dos monedas
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<number>} Tipo de cambio
     */
    async getExchangeRate(currencyBase, currencyQuote) {
        try {
            structuredLogger.info('TradingService', 'Getting exchange rate', {
                currencyBase,
                currencyQuote
            });

            // Obtener el tipo de cambio del puerto (que maneja BD y Binance)
            const exchangeRate = await this.tradingPort.getExchangeRate(currencyBase, currencyQuote);

            // Validar que el tipo de cambio sea válido
            if (typeof exchangeRate !== 'number' || exchangeRate <= 0) {
                throw new Error('Tipo de cambio inválido recibido del proveedor');
            }

            structuredLogger.info('TradingService', 'Exchange rate obtained successfully', {
                currencyBase,
                currencyQuote,
                exchangeRate
            });

            return exchangeRate;

        } catch (error) {
            structuredLogger.error('TradingService', 'Error getting exchange rate', error, {
                currencyBase,
                currencyQuote
            });
            throw error;
        }
    }

    /**
     * Calcula el monto convertido basado en el tipo de cambio
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @param {number} amount - Cantidad a convertir
     * @param {Date} dateExchange - Fecha de cambio (opcional, por defecto hoy)
     * @returns {Promise<Object>} Resultado del cálculo
     */
    async calculateExchange(currencyBase, currencyQuote, amount, dateExchange = new Date()) {
        try {
            structuredLogger.info('TradingService', 'Calculating exchange', {
                currencyBase,
                currencyQuote,
                amount,
                dateExchange: dateExchange.toISOString()
            });

            // Obtener el precio de trading de la base de datos
            const tradePrice = await this.tradingPort.getTradePrice(dateExchange, currencyBase, currencyQuote);

            // Calcular el monto convertido
            const calculatedAmount = this.performCalculation(amount, tradePrice);

            const result = {
                currencyBase,
                currencyQuote,
                originalAmount: amount,
                tradePrice: tradePrice,
                calculatedAmount: calculatedAmount,
                dateExchange: dateExchange.toISOString().split('T')[0],
                timestamp: new Date().toISOString()
            };

            structuredLogger.info('TradingService', 'Exchange calculation completed', {
                currencyBase,
                currencyQuote,
                amount,
                tradePrice,
                calculatedAmount,
                dateExchange: dateExchange.toISOString().split('T')[0]
            });

            return result;

        } catch (error) {
            structuredLogger.error('TradingService', 'Error calculating exchange', error, {
                currencyBase,
                currencyQuote,
                amount,
                dateExchange: dateExchange?.toISOString()
            });
            throw error;
        }
    }

    /**
     * Obtiene el historial de tipos de cambio
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @param {Date} startDate - Fecha de inicio
     * @param {Date} endDate - Fecha de fin
     * @returns {Promise<Array>} Historial de tipos de cambio
     */
    async getExchangeRateHistory(currencyBase, currencyQuote, startDate, endDate) {
        try {
            structuredLogger.info('TradingService', 'Getting exchange rate history', {
                currencyBase,
                currencyQuote,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });

            // Validar fechas
            if (startDate >= endDate) {
                throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
            }

            // Obtener historial del puerto
            const history = await this.tradingPort.getExchangeRateHistory(
                currencyBase,
                currencyQuote,
                startDate,
                endDate
            );

            structuredLogger.info('TradingService', 'Exchange rate history obtained', {
                currencyBase,
                currencyQuote,
                recordCount: history.length
            });

            return history;

        } catch (error) {
            structuredLogger.error('TradingService', 'Error getting exchange rate history', error, {
                currencyBase,
                currencyQuote,
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString()
            });
            throw error;
        }
    }

    /**
     * Obtiene las monedas disponibles para trading
     * @returns {Promise<Array>} Lista de monedas disponibles
     */
    async getAvailableCurrencies() {
        try {
            structuredLogger.info('TradingService', 'Getting available currencies');

            const currencies = await this.tradingPort.getAvailableCurrencies();

            structuredLogger.info('TradingService', 'Available currencies obtained', {
                currencyCount: currencies.length
            });

            return currencies;

        } catch (error) {
            structuredLogger.error('TradingService', 'Error getting available currencies', error);
            throw error;
        }
    }

    /**
     * Realiza el cálculo matemático del tipo de cambio
     * @param {number} amount - Cantidad original
     * @param {number} exchangeRate - Tipo de cambio
     * @returns {number} Cantidad calculada
     */
    performCalculation(amount, exchangeRate) {
        // Redondear a 4 decimales para evitar errores de precisión
        return Math.round((amount * exchangeRate) * 10000) / 10000;
    }

    /**
     * Obtiene el precio de trading usando Binance
     * @param {Object} params - Parámetros de trading
     * @param {string} params.typeTrade - Tipo de operación (BUY/SELL)
     * @param {string} params.currencyBase - Moneda base (ISO 4217)
     * @param {string} params.currencyQuote - Moneda cotizada (ISO 4217)
     * @param {number} params.amountQuote - Cantidad a cotizar
     * @param {Array} params.optionsTypePay - Opciones de pago
     * @returns {Promise<Object>} Resultado del trading
     */
    async getTradingPrice(params) {
        try {
            structuredLogger.info('TradingService', 'Getting trading price from Binance', {
                typeTrade: params.typeTrade,
                currencyBase: params.currencyBase,
                currencyQuote: params.currencyQuote,
                amountQuote: params.amountQuote,
                optionsTypePayCount: params.optionsTypePay?.length || 0
            });

            // Obtener el precio de trading del puerto (que maneja Binance)
            const tradingPrice = await this.tradingPort.getTradingPrice(params);

            structuredLogger.info('TradingService', 'Trading price obtained successfully', {
                typeTrade: params.typeTrade,
                currencyBase: params.currencyBase,
                currencyQuote: params.currencyQuote,
                price: tradingPrice.price
            });

            return tradingPrice;

        } catch (error) {
            structuredLogger.error('TradingService', 'Error getting trading price', error, {
                typeTrade: params?.typeTrade,
                currencyBase: params?.currencyBase,
                currencyQuote: params?.currencyQuote,
                amountQuote: params?.amountQuote
            });
            throw error;
        }
    }
}

module.exports = TradingService;