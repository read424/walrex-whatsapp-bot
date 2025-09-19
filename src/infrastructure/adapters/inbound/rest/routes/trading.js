const express = require('express');
const structuredLogger = require('../../../../../infrastructure/config/StructuredLogger');

const router = express.Router();

/**
 * GET /api/trading/calculate-exchange
 * Calcular tipo de cambio
 */
router.get('/calculate-exchange', async (req, res) => {
    try {
        const { currency_base, currency_quote, amount } = req.body;
        
        structuredLogger.info('TRADING_ROUTES', 'Calculate trade exchange request', {
            currency_base,
            currency_quote,
            amount,
            correlationId: req.correlationId
        });
        
        // Validar parámetros requeridos
        if (!currency_base || !currency_quote || !amount) {
            return res.status(400).json({
                success: false,
                message: 'currency_base, currency_quote y amount son requeridos'
            });
        }
        
        // Validar que las monedas sean códigos ISO 4217 válidos (3 caracteres)
        const iso4217Regex = /^[A-Z]{3}$/;
        if (!iso4217Regex.test(currency_base)) {
            return res.status(400).json({
                success: false,
                message: 'currency_base debe ser un código ISO 4217 válido (3 caracteres)'
            });
        }
        
        if (!iso4217Regex.test(currency_quote)) {
            return res.status(400).json({
                success: false,
                message: 'currency_quote debe ser un código ISO 4217 válido (3 caracteres)'
            });
        }
        
        // Validar que amount sea un número decimal válido
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({
                success: false,
                message: 'amount debe ser un número decimal válido mayor a 0'
            });
        }
        
        // TODO: Implementar con el caso de uso cuando se complete el adaptador
        // const result = await calculateTradeExchangeUseCase.execute({
        //     currencyBase: currency_base,
        //     currencyQuote: currency_quote,
        //     amount: amountNum
        // });
        
        // Por ahora retornamos una respuesta de ejemplo
        const mockExchangeRate = 1.25; // Tipo de cambio de ejemplo
        const calculatedAmount = amountNum * mockExchangeRate;
        
        const response = {
            success: true,
            data: {
                currency_base,
                currency_quote,
                original_amount: amountNum,
                exchange_rate: mockExchangeRate,
                calculated_amount: calculatedAmount,
                timestamp: new Date().toISOString()
            }
        };
        
        structuredLogger.info('TRADING_ROUTES', 'Calculate trade exchange successful', {
            currency_base,
            currency_quote,
            amount: amountNum,
            exchange_rate: mockExchangeRate,
            calculated_amount: calculatedAmount,
            correlationId: req.correlationId
        });
        
        res.status(200).json(response);
        
    } catch (error) {
        structuredLogger.error('TRADING_ROUTES', 'Calculate trade exchange error', error, {
            correlationId: req.correlationId
        });
        res.status(500).json({
            success: false,
            message: 'Error al calcular el tipo de cambio'
        });
    }
});

/**
 * POST /api/trading/create-exchange
 * Crear intercambio de trading
 */
router.post('/create-exchange', async (req, res) => {
    const { currency_base, currency_quote, amount, asset } = req.body || {};
    try {
        structuredLogger.info('TRADING_ROUTES', 'Create exchange trading request', {
            currency_base, currency_quote, amount, asset, correlationId: req.correlationId
        });

        // Validaciones básicas
        const iso = /^[A-Z]{3}$/;
        if (!iso.test(currency_base) || !iso.test(currency_quote)) {
            return res.status(400).json({ success: false, message: 'currency_base y currency_quote deben ser ISO 4217' });
        }
        const parsedAmount = Number(amount);
        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'amount debe ser decimal > 0' });
        }
        if (!asset || typeof asset !== 'string') {
            return res.status(400).json({ success: false, message: 'asset es requerido' });
        }

        // Composition root (simple) para inyección de dependencias
        const { TradingAdapter, ExchangeRateRepositoryAdapter } = require('../../outbound');
        const BankTradeRepositoryAdapter = require('../../outbound/BankTradeRepositoryAdapter');
        const BinanceAPIAdapter = require('../../outbound/BinanceAPIAdapter');
        const { TradingService } = require('../../../domain/service');
        const { CreateExchangeTradingUseCase } = require('../../../application/usecases');

        function buildCreateExchangeTradingUseCase() {
            const exchangeRateRepository = new ExchangeRateRepositoryAdapter();
            const binanceApi = new BinanceAPIAdapter();
            const tradingAdapter = new TradingAdapter(exchangeRateRepository, binanceApi);
            const tradingService = new TradingService(tradingAdapter);
            const bankTradeRepo = new BankTradeRepositoryAdapter();
            return new CreateExchangeTradingUseCase(tradingService, bankTradeRepo);
        }

        const useCase = buildCreateExchangeTradingUseCase();
        const result = await useCase.execute({
            currencyBase: currency_base,
            currencyQuote: currency_quote,
            amount: parsedAmount,
            asset
        });
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        structuredLogger.error('TRADING_ROUTES', 'Create exchange trading error', error, { correlationId: req.correlationId });
        return res.status(500).json({ success: false, message: error.message || 'Error interno' });
    }
});

module.exports = router;