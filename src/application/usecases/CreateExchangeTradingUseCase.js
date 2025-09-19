const structuredLogger = require('../../infrastructure/config/StructuredLogger');

/**
 * Caso de uso para crear exchange trading usando Binance
 * Sigue la arquitectura hexagonal - Capa de aplicación
 */
class CreateExchangeTradingUseCase {
    constructor(tradingService, bankTradeRepository) {
        this.tradingService = tradingService;
        this.bankTradeRepository = bankTradeRepository;
    }

    /**
     * Ejecuta el caso de uso para crear exchange trading
     * @param {Object} params - Parámetros de entrada
     * @param {string} params.currencyBase - Moneda base (ISO 4217)
     * @param {string} params.currencyQuote - Moneda cotizada (ISO 4217)
     * @param {number} params.amount - Cantidad a convertir
     * @param {number} params.countryId - ID del país para métodos de pago
     * @returns {Promise<Object>} Resultado del exchange trading
     */
    async execute(params) {
        try {
            structuredLogger.info('CreateExchangeTradingUseCase', 'Executing create exchange trading use case', {
                currencyBase: params.currencyBase,
                currencyQuote: params.currencyQuote,
                amount: params.amount,
                countryId: params.countryId
            });

            // Validar parámetros de entrada
            this.validateInput(params);

            // 1. Obtener métodos de pago disponibles para el país
            const paymentMethods = await this.bankTradeRepository.getPaymentMethodsByCountry(params.countryId);
            
            if (!paymentMethods || paymentMethods.length === 0) {
                throw new Error(`No hay métodos de pago disponibles para el país ID: ${params.countryId}`);
            }

            structuredLogger.info('CreateExchangeTradingUseCase', 'Payment methods retrieved', {
                countryId: params.countryId,
                paymentMethodsCount: paymentMethods.length
            });

            // 2. Obtener el precio de trading usando Binance
            // Para comprar USDT con la moneda base (ej: PEN)
            const tradingResult = await this.tradingService.getTradingPrice({
                typeTrade: 'BUY',
                currencyBase: params.currencyBase, // ej: PEN
                currencyQuote: 'USDT',
                amountQuote: params.amount,
                optionsTypePay: paymentMethods.map(method => ({
                    id: method.id,
                    bankName: method.bank.name,
                    bankCode: method.bank.code,
                    countryName: method.country.name
                }))
            });

            const result = {
                currencyBase: params.currencyBase,
                currencyQuote: params.currencyQuote,
                originalAmount: params.amount,
                tradingPrice: tradingResult.price,
                paymentMethods: paymentMethods,
                tradingDetails: tradingResult,
                timestamp: new Date().toISOString()
            };

            structuredLogger.info('CreateExchangeTradingUseCase', 'Exchange trading created successfully', {
                currencyBase: params.currencyBase,
                currencyQuote: params.currencyQuote,
                amount: params.amount,
                tradingPrice: tradingResult.price,
                paymentMethodsCount: paymentMethods.length
            });

            return result;

        } catch (error) {
            structuredLogger.error('CreateExchangeTradingUseCase', 'Error executing create exchange trading use case', error, {
                currencyBase: params?.currencyBase,
                currencyQuote: params?.currencyQuote,
                amount: params?.amount,
                countryId: params?.countryId
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

        if (typeof params.countryId !== 'number' || params.countryId <= 0) {
            throw new Error('countryId debe ser un número válido mayor a 0');
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

module.exports = CreateExchangeTradingUseCase; 