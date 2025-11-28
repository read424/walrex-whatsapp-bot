/**
 * Controlador REST para endpoints de Trading
 * Responsabilidades:
 * - Extraer parámetros HTTP
 * - Llamar casos de uso inyectados
 * - Mapear respuestas a HTTP
 * - Manejo de errores HTTP
 *
 * NO contiene lógica de negocio ni validaciones de negocio
 */
class TradingController {
    /**
     * @param {CalculateExchangeUseCase} calculateExchangeUseCase - Caso de uso inyectado
     * @param {CreateExchangeTradingUseCase} createExchangeUseCase - Caso de uso inyectado
     * @param {LoggerPort} logger - Puerto de logger inyectado
     */
    constructor(calculateExchangeUseCase, createExchangeUseCase, logger) {
        this.calculateExchangeUseCase = calculateExchangeUseCase;
        this.createExchangeUseCase = createExchangeUseCase;
        this.logger = logger;
    }

    /**
     * GET /api/trading/calculate-exchange
     * Calcular tipo de cambio
     */
    async calculateExchange(req, res) {
        try {
            const { currency_base, currency_quote, amount } = req.body;

            this.logger.info('TradingController', 'Calculate exchange request', {
                currency_base,
                currency_quote,
                amount,
                correlationId: req.correlationId
            });

            // Ejecutar caso de uso (las validaciones están en el caso de uso)
            const result = await this.calculateExchangeUseCase.execute({
                currencyBase: currency_base,
                currencyQuote: currency_quote,
                amount: parseFloat(amount)
            });

            this.logger.info('TradingController', 'Calculate exchange successful', {
                currency_base,
                currency_quote,
                correlationId: req.correlationId
            });

            res.status(200).json({
                success: true,
                data: result
            });

        } catch (error) {
            this.handleError(error, req, res, 'calculateExchange');
        }
    }

    /**
     * POST /api/trading/create-exchange
     * Crear una transacción de intercambio
     */
    async createExchange(req, res) {
        try {
            const tradingData = req.body;

            this.logger.info('TradingController', 'Create exchange request', {
                tradingData,
                correlationId: req.correlationId
            });

            // Ejecutar caso de uso
            const result = await this.createExchangeUseCase.execute(tradingData);

            this.logger.info('TradingController', 'Create exchange successful', {
                tradingId: result.id,
                correlationId: req.correlationId
            });

            res.status(201).json({
                success: true,
                data: result
            });

        } catch (error) {
            this.handleError(error, req, res, 'createExchange');
        }
    }

    /**
     * Manejo centralizado de errores HTTP
     */
    handleError(error, req, res, operation) {
        this.logger.error('TradingController', `Error in ${operation}`, {
            error: error.message,
            stack: error.stack,
            correlationId: req.correlationId
        });

        // Mapear excepciones de dominio a códigos HTTP
        if (error.name === 'IllegalArgumentException') {
            return res.status(400).json({
                success: false,
                error: {
                    message: error.message,
                    code: 'INVALID_INPUT'
                }
            });
        }

        if (error.name === 'TradingException') {
            return res.status(422).json({
                success: false,
                error: {
                    message: error.message,
                    code: 'TRADING_ERROR'
                }
            });
        }

        // Error genérico del sistema
        res.status(500).json({
            success: false,
            error: {
                message: 'Error interno del servidor',
                code: 'INTERNAL_ERROR'
            }
        });
    }
}

module.exports = TradingController;