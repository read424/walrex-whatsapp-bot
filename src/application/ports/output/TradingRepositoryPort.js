/**
 * Puerto (interfaz) para operaciones de repositorio de trading
 * Define el contrato que debe cumplir cualquier implementación de repositorio de trading
 * Sigue la arquitectura hexagonal - Capa de aplicación
 */
class TradingRepositoryPort {
    /**
     * Obtiene las monedas configuradas para trading con sus bancos asociados
     * @param {number} idCompany - ID de la empresa
     * @returns {Promise<Array>} Lista de monedas configuradas para trading con información de bancos
     * @throws {Error} Si hay error al obtener las monedas
     */
    async getTradingCurrenciesWithBanks(idCompany) {
        throw new Error('getTradingCurrenciesWithBanks method must be implemented');
    }

    /**
     * Obtiene precios activos de la base de datos para una fecha específica
     * @param {Date} dateExchange - Fecha de cambio (por defecto, fecha actual)
     * @returns {Promise<Array>} Lista de precios activos
     * @throws {Error} Si hay error al obtener los precios
     */
    async getActivePrices(dateExchange = null) {
        throw new Error('getActivePrices method must be implemented');
    }

    /**
     * Obtiene configuración de trading por ID
     * @param {number} tradingConfigId - ID de la configuración de trading
     * @returns {Promise<Object|null>} Configuración de trading o null si no existe
     * @throws {Error} Si hay error al obtener la configuración
     */
    async getTradingConfigById(tradingConfigId) {
        throw new Error('getTradingConfigById method must be implemented');
    }

    /**
     * Obtiene configuración de trading por par de monedas
     * @param {number} idCompany - ID de la empresa
     * @param {number} baseCurrencyId - ID de la moneda base
     * @param {number} quoteCurrencyId - ID de la moneda cotizada
     * @returns {Promise<Object|null>} Configuración de trading o null si no existe
     * @throws {Error} Si hay error al obtener la configuración
     */
    async getTradingConfigByPair(idCompany, baseCurrencyId, quoteCurrencyId) {
        throw new Error('getTradingConfigByPair method must be implemented');
    }

    /**
     * Obtiene todos los pares de trading configurados para una empresa
     * @param {number} idCompany - ID de la empresa
     * @returns {Promise<Array>} Lista de pares de trading configurados
     * @throws {Error} Si hay error al obtener los pares
     */
    async getAllTradingPairs(idCompany) {
        throw new Error('getAllTradingPairs method must be implemented');
    }

    /**
     * Obtiene bancos disponibles por país
     * @param {number} countryId - ID del país
     * @returns {Promise<Array>} Lista de bancos disponibles
     * @throws {Error} Si hay error al obtener los bancos
     */
    async getBanksByCountry(countryId) {
        throw new Error('getBanksByCountry method must be implemented');
    }
}

module.exports = TradingRepositoryPort;