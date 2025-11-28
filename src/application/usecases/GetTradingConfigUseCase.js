/**
 * Caso de uso: Obtener configuración de trading
 *
 * Responsabilidades:
 * 1. Obtener configuración de pares de trading para una empresa
 * 2. Retornar datos puros (sin formateo)
 */
class GetTradingConfigUseCase {
    constructor(tradingRepository, logger) {
        this.tradingRepository = tradingRepository;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso
     * @param {Object} params - Parámetros
     * @param {number} params.idCompany - ID de la empresa
     * @returns {Promise<Array>} - Configuraciones de trading
     */
    async execute({ idCompany } = {}) {
        this.logger.info('GetTradingConfigUseCase', 'Getting trading configuration', { idCompany });

        try {
            const tradingConfig = await this.tradingRepository.getTradingCurrenciesWithBanks(idCompany);

            if (!tradingConfig || tradingConfig.length === 0) {
                this.logger.warn('GetTradingConfigUseCase', 'No trading configuration found', { idCompany });
                return [];
            }

            this.logger.info('GetTradingConfigUseCase', 'Trading configuration retrieved successfully', {
                idCompany,
                count: tradingConfig.length
            });

            return tradingConfig;

        } catch (error) {
            this.logger.error('GetTradingConfigUseCase', 'Error getting trading configuration', error, { idCompany });
            throw error;
        }
    }
}

module.exports = GetTradingConfigUseCase;