/**
 * Caso de uso: Obtener precios activos de trading
 *
 * Responsabilidades:
 * 1. Obtener precios activos de la base de datos
 * 2. Si no hay precios activos, consultar Binance
 * 3. Retornar datos puros (sin formateo)
 */
class GetActivePricesUseCase {
    constructor(tradingRepository, tradingAdapter, logger) {
        this.tradingRepository = tradingRepository;
        this.tradingAdapter = tradingAdapter;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso
     * @param {Object} params - Parámetros
     * @param {number} params.idCompany - ID de la empresa
     * @returns {Promise<Object>} - Resultado con precios
     */
    async execute({ idCompany = 1 } = {}) {
        this.logger.info('GetActivePricesUseCase', 'Getting active prices', { idCompany });

        try {
            // 1. Intentar obtener precios activos de la BD
            const activePrices = await this.tradingRepository.getActivePrices();

            if (activePrices && activePrices.length > 0) {
                this.logger.info('GetActivePricesUseCase', 'Active prices found in database', {
                    count: activePrices.length
                });

                return {
                    source: 'database',
                    prices: activePrices
                };
            }

            // 2. Si no hay precios activos, consultar Binance
            this.logger.info('GetActivePricesUseCase', 'No active prices in DB, fetching from Binance');

            if (!this.tradingAdapter) {
                throw new Error('TradingAdapter not available');
            }

            // Obtener configuración de trading
            const tradingCurrencies = await this.tradingRepository.getTradingCurrenciesWithBanks(idCompany);

            if (!tradingCurrencies || tradingCurrencies.length === 0) {
                throw new Error('No trading currencies configured');
            }

            // Obtener tasas desde Binance
            const rates = [];

            for (const currency of tradingCurrencies) {
                try {
                    const baseCode = currency.baseCurrency?.code_iso3;
                    const quoteCode = currency.quoteCurrency?.code_iso3;

                    if (baseCode && quoteCode) {
                        const rate = await this.tradingAdapter.getExchangeRate(baseCode, quoteCode);

                        rates.push({
                            baseCode,
                            quoteCode,
                            rate,
                            revenue: parseFloat(currency.porc_revenue || 0)
                        });
                    }
                } catch (error) {
                    this.logger.warn('GetActivePricesUseCase', `Error getting rate for ${currency.baseCurrency?.code_iso3}-${currency.quoteCurrency?.code_iso3}`, {
                        error: error.message
                    });
                }
            }

            this.logger.info('GetActivePricesUseCase', 'Rates fetched from Binance', {
                count: rates.length
            });

            return {
                source: 'binance',
                prices: rates
            };

        } catch (error) {
            this.logger.error('GetActivePricesUseCase', 'Error getting active prices', error);
            throw error;
        }
    }
}

module.exports = GetActivePricesUseCase;