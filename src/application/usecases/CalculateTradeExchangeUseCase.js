const structuredLogger = require('../../infrastructure/config/StructuredLogger');

/**
 * Caso de uso para calcular el tipo de cambio de trading
 * Sigue la arquitectura hexagonal - Capa de aplicación
 */
class CalculateTradeExchangeUseCase {
    constructor(tradingService) {
        this.tradingService = tradingService;
    }

    /**
     * Ejecuta el caso de uso para calcular el tipo de cambio
     * @param {Object} params - Parámetros de entrada
     * @param {string} params.currencyBase - Moneda base (ISO 4217)
     * @param {string} params.currencyQuote - Moneda cotizada (ISO 4217)
     * @param {number} params.amount - Cantidad a convertir
     * @returns {Promise<Object>} Resultado del cálculo
     */
    async execute(params) {
        try {
            structuredLogger.info('CalculateTradeExchangeUseCase', 'Executing use case', {
                currencyBase: params.currencyBase,
                currencyQuote: params.currencyQuote,
                amount: params.amount
            });

            // Validar parámetros de entrada
            this.validateInput(params);

            // Llamar al servicio de dominio para obtener el tipo de cambio
            const exchangeRate = await this.tradingService.getExchangeRate(
                params.currencyBase,
                params.currencyQuote
            );

            // Calcular el monto convertido
            const calculatedAmount = params.amount * exchangeRate;

            const result = {
                currencyBase: params.currencyBase,
                currencyQuote: params.currencyQuote,
                originalAmount: params.amount,
                exchangeRate: exchangeRate,
                calculatedAmount: calculatedAmount,
                timestamp: new Date().toISOString()
            };

            structuredLogger.info('CalculateTradeExchangeUseCase', 'Use case executed successfully', {
                currencyBase: params.currencyBase,
                currencyQuote: params.currencyQuote,
                amount: params.amount,
                exchangeRate: exchangeRate,
                calculatedAmount: calculatedAmount
            });

            return result;

        } catch (error) {
            structuredLogger.error('CalculateTradeExchangeUseCase', 'Error executing use case', error, {
                currencyBase: params?.currencyBase,
                currencyQuote: params?.currencyQuote,
                amount: params?.amount
            });
            throw error;
        }
    }

    /**
     * Valida los parámetros de entrada
     * @param {Object} params - Parámetros a validar
     * @throws {Error} Si los parámetros no son válidos
     */
    validateInput(params) {
        if (!params) {
            throw new Error('Parámetros requeridos');
        }

        if (!params.currencyBase || typeof params.currencyBase !== 'string') {
            throw new Error('currencyBase debe ser una cadena válida');
        }

        if (!params.currencyQuote || typeof params.currencyQuote !== 'string') {
            throw new Error('currencyQuote debe ser una cadena válida');
        }

        if (typeof params.amount !== 'number' || params.amount <= 0) {
            throw new Error('amount debe ser un número mayor a 0');
        }

        // Validar formato ISO 4217 (3 caracteres mayúsculas)
        const iso4217Regex = /^[A-Z]{3}$/;
        if (!iso4217Regex.test(params.currencyBase)) {
            throw new Error('currencyBase debe ser un código ISO 4217 válido (3 caracteres)');
        }

        if (!iso4217Regex.test(params.currencyQuote)) {
            throw new Error('currencyQuote debe ser un código ISO 4217 válido (3 caracteres)');
        }

        // Validar que las monedas sean diferentes
        if (params.currencyBase === params.currencyQuote) {
            throw new Error('currencyBase y currencyQuote deben ser diferentes');
        }
    }
}

module.exports = CalculateTradeExchangeUseCase; 