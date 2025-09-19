const structuredLogger = require('../../config/StructuredLogger');

/**
 * Adaptador de trading que implementa TradingPort
 * Sigue la arquitectura hexagonal - Capa de infraestructura
 * Agrega funcionalidad de base de datos y Binance API
 */
class TradingAdapter {
    constructor(exchangeRateRepository, binanceApi) {
        this.exchangeRateRepository = exchangeRateRepository;
        this.binanceApi = binanceApi;
        this.CACHE_DURATION_MINUTES = 5; // Cache de 5 minutos
    }

    /**
     * Obtiene el tipo de cambio entre dos monedas
     * Estrategia: Primero busca en BD, si no existe o es muy viejo, consulta Binance
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<number>} Tipo de cambio
     */
    async getExchangeRate(currencyBase, currencyQuote) {
        try {
            structuredLogger.info('TradingAdapter', 'Getting exchange rate', {
                currencyBase,
                currencyQuote
            });

            // 1. Verificar si existe un tipo de cambio reciente en BD
            const hasRecentRate = await this.exchangeRateRepository.hasRecentExchangeRate(
                currencyBase,
                currencyQuote
            );

            if (hasRecentRate) {
                // 2. Obtener de BD si es reciente
                const dbRate = await this.exchangeRateRepository.getLatestExchangeRate(
                    currencyBase,
                    currencyQuote
                );

                structuredLogger.info('TradingAdapter', 'Using cached exchange rate from DB', {
                    currencyBase,
                    currencyQuote,
                    rate: dbRate.rate,
                    timestamp: dbRate.timestamp
                });

                return dbRate.rate;
            }

            // 3. Si no es reciente, obtener de Binance
            structuredLogger.info('TradingAdapter', 'Fetching fresh rate from Binance', {
                currencyBase,
                currencyQuote
            });

            const binanceRate = await this.binanceApi.getExchangeRate(currencyBase, currencyQuote);

            // 4. Guardar en BD para cache
            await this.exchangeRateRepository.saveExchangeRate({
                currencyBase,
                currencyQuote,
                rate: binanceRate,
                timestamp: new Date()
            });

            structuredLogger.info('TradingAdapter', 'Exchange rate saved to DB', {
                currencyBase,
                currencyQuote,
                rate: binanceRate
            });

            return binanceRate;

        } catch (error) {
            structuredLogger.error('TradingAdapter', 'Error getting exchange rate', error, {
                currencyBase,
                currencyQuote
            });
            throw error;
        }
    }

    /**
     * Obtiene información histórica de tipos de cambio
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @param {Date} startDate - Fecha de inicio
     * @param {Date} endDate - Fecha de fin
     * @returns {Promise<Array>} Historial de tipos de cambio
     */
    async getExchangeRateHistory(currencyBase, currencyQuote, startDate, endDate) {
        try {
            structuredLogger.info('TradingAdapter', 'Getting exchange rate history', {
                currencyBase,
                currencyQuote,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });

            // Obtener historial de BD
            const history = await this.exchangeRateRepository.getExchangeRateHistory(
                currencyBase,
                currencyQuote,
                startDate,
                endDate
            );

            structuredLogger.info('TradingAdapter', 'Exchange rate history retrieved', {
                currencyBase,
                currencyQuote,
                recordCount: history.length
            });

            return history;

        } catch (error) {
            structuredLogger.error('TradingAdapter', 'Error getting exchange rate history', error, {
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
            structuredLogger.info('TradingAdapter', 'Getting available currencies');

            // Obtener monedas de BD
            const dbCurrencies = await this.exchangeRateRepository.getAvailableCurrencies();

            // Obtener símbolos de Binance
            const binanceSymbols = await this.binanceApi.getAvailableSymbols();

            // Combinar y deduplicar
            const allCurrencies = new Set([
                ...dbCurrencies,
                ...this.extractCurrenciesFromBinanceSymbols(binanceSymbols)
            ]);

            const result = Array.from(allCurrencies);

            structuredLogger.info('TradingAdapter', 'Available currencies retrieved', {
                currencyCount: result.length,
                dbCount: dbCurrencies.length,
                binanceCount: binanceSymbols.length
            });

            return result;

        } catch (error) {
            structuredLogger.error('TradingAdapter', 'Error getting available currencies', error);
            throw error;
        }
    }

    /**
     * Valida si un par de monedas es válido para trading
     * @param {string} currencyBase - Moneda base (ISO 4217)
     * @param {string} currencyQuote - Moneda cotizada (ISO 4217)
     * @returns {Promise<boolean>} True si el par es válido
     */
    async isValidTradingPair(currencyBase, currencyQuote) {
        try {
            structuredLogger.info('TradingAdapter', 'Validating trading pair', {
                currencyBase,
                currencyQuote
            });

            // Verificar en Binance
            const isAvailableInBinance = await this.binanceApi.isSymbolAvailable(
                currencyBase,
                currencyQuote
            );

            structuredLogger.info('TradingAdapter', 'Trading pair validation result', {
                currencyBase,
                currencyQuote,
                isValid: isAvailableInBinance
            });

            return isAvailableInBinance;

        } catch (error) {
            structuredLogger.error('TradingAdapter', 'Error validating trading pair', error, {
                currencyBase,
                currencyQuote
            });
            return false;
        }
    }

    /**
     * Extrae monedas únicas de los símbolos de Binance
     * @param {Array} symbols - Lista de símbolos de Binance
     * @returns {Array} Lista de monedas únicas
     */
    extractCurrenciesFromBinanceSymbols(symbols) {
        const currencies = new Set();
        
        symbols.forEach(symbol => {
            // Extraer monedas de símbolos como BTCUSDT, ETHUSDT, etc.
            // Asumiendo que los símbolos tienen formato BASEQUOTE
            if (symbol.length >= 6) {
                const base = symbol.substring(0, 3);
                const quote = symbol.substring(3, 6);
                
                if (this.isValidCurrencyCode(base)) {
                    currencies.add(base);
                }
                if (this.isValidCurrencyCode(quote)) {
                    currencies.add(quote);
                }
            }
        });

        return Array.from(currencies);
    }

    /**
     * Valida si un código de moneda es válido
     * @param {string} currencyCode - Código de moneda
     * @returns {boolean} True si es válido
     */
    isValidCurrencyCode(currencyCode) {
        return /^[A-Z]{3}$/.test(currencyCode);
    }

    /**
     * Delegación para obtener precio de trading desde proveedor (Binance)
     */
    async getTradingPrice(params) {
        return this.binanceApi.getPriceTradingPair(
            params.typeTrade,
            params.currencyBase,
            params.currencyQuote,
            params.amountQuote,
            params.optionsTypePay
        );
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
            structuredLogger.info('TradingAdapter', 'Getting trade price', {
                dateExchange: dateExchange.toISOString(),
                currencyBaseCode,
                currencyQuoteCode
            });

            // Delegar al repositorio de base de datos
            const tradePrice = await this.exchangeRateRepository.getTradePrice(
                dateExchange,
                currencyBaseCode,
                currencyQuoteCode
            );

            structuredLogger.info('TradingAdapter', 'Trade price obtained successfully', {
                dateExchange: dateExchange.toISOString(),
                currencyBaseCode,
                currencyQuoteCode,
                tradePrice
            });

            return tradePrice;

        } catch (error) {
            structuredLogger.error('TradingAdapter', 'Error getting trade price', error, {
                dateExchange: dateExchange?.toISOString(),
                currencyBaseCode,
                currencyQuoteCode
            });
            throw error;
        }
    }
}

module.exports = TradingAdapter; 