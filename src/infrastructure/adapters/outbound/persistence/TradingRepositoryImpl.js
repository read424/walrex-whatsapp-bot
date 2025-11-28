const TradingRepositoryPort = require('../../../../application/ports/output/TradingRepositoryPort');
const { TradingCurrencies, Currency, BankTrade, Bank, Country, PriceExchange } = require('./entity');

/**
 * Implementación del repositorio de Trading usando Sequelize
 * Esta clase pertenece a la capa de infraestructura
 * Adapta las operaciones de persistencia de trading a través del puerto TradingRepositoryPort
 */
class TradingRepositoryImpl extends TradingRepositoryPort {
    /**
     * Obtiene las monedas configuradas para trading con sus bancos asociados
     * @param {number} idCompany - ID de la empresa
     * @returns {Promise<Array>} Lista de monedas configuradas para trading con información de bancos
     */
    async getTradingCurrenciesWithBanks(idCompany) {
        try {
            const tradingConfig = await TradingCurrencies.findAll({
                where: {
                    status: '1',
                    id_company: idCompany
                },
                include: [
                    {
                        model: Currency,
                        as: 'baseCurrency',
                        attributes: ['code_iso3', 'name', 'id_country'],
                        include: [
                            {
                                model: Country,
                                as: 'Country',
                                attributes: ['name']
                            }
                        ]
                    },
                    {
                        model: Currency,
                        as: 'quoteCurrency',
                        attributes: ['code_iso3', 'name', 'id_country'],
                        include: [
                            {
                                model: Country,
                                as: 'Country',
                                attributes: ['name']
                            }
                        ]
                    }
                ],
                order: [
                    ['id_currency_base', 'ASC'],
                    ['id_currency_quote', 'ASC']
                ]
            });

            // Para cada configuración de trading, obtener los bancos disponibles
            const tradingConfigWithBanks = await Promise.all(
                tradingConfig.map(async (config) => {
                    const configData = config.toJSON();

                    // Obtener bancos para la moneda base (si es fiat)
                    let baseCurrencyBanks = [];
                    if (configData.baseCurrency && configData.baseCurrency.id_country) {
                        baseCurrencyBanks = await this._getBanksByCountry(configData.baseCurrency.id_country);
                    }

                    // Obtener bancos para la moneda quote (si es fiat)
                    let quoteCurrencyBanks = [];
                    if (configData.quoteCurrency && configData.quoteCurrency.id_country) {
                        quoteCurrencyBanks = await this._getBanksByCountry(configData.quoteCurrency.id_country);
                    }

                    // Agregar la información de bancos al resultado
                    return {
                        ...configData,
                        baseCurrencyBanks,
                        quoteCurrencyBanks
                    };
                })
            );

            return tradingConfigWithBanks;

        } catch (error) {
            throw new Error(`Error getting trading currencies with banks: ${error.message}`);
        }
    }

    /**
     * Obtiene precios activos de la base de datos para una fecha específica
     * @param {Date} dateExchange - Fecha de cambio (por defecto, fecha actual)
     * @returns {Promise<Array>} Lista de precios activos
     */
    async getActivePrices(dateExchange = null) {
        try {
            const { Op } = require('sequelize');

            // Obtener fecha actual si no se proporciona
            const searchDate = dateExchange || new Date();
            searchDate.setHours(0, 0, 0, 0);

            // Buscar precios activos para la fecha especificada
            const activePrices = await PriceExchange.findAll({
                where: {
                    is_active: '1',
                    date_exchange: {
                        [Op.eq]: searchDate
                    }
                },
                include: [
                    {
                        model: Currency,
                        as: 'baseCurrency',
                        attributes: ['code_iso3', 'name']
                    },
                    {
                        model: Currency,
                        as: 'quoteCurrency',
                        attributes: ['code_iso3', 'name']
                    }
                ],
                order: [
                    ['type_operation', 'ASC'],
                    ['id_currency_base', 'ASC']
                ]
            });

            return activePrices;

        } catch (error) {
            throw new Error(`Error getting active prices: ${error.message}`);
        }
    }

    /**
     * Obtiene configuración de trading por ID
     * @param {number} tradingConfigId - ID de la configuración de trading
     * @returns {Promise<Object|null>} Configuración de trading o null si no existe
     */
    async getTradingConfigById(tradingConfigId) {
        try {
            const config = await TradingCurrencies.findByPk(tradingConfigId, {
                include: [
                    {
                        model: Currency,
                        as: 'baseCurrency',
                        attributes: ['code_iso3', 'name', 'id_country']
                    },
                    {
                        model: Currency,
                        as: 'quoteCurrency',
                        attributes: ['code_iso3', 'name', 'id_country']
                    }
                ]
            });

            return config ? config.toJSON() : null;

        } catch (error) {
            throw new Error(`Error getting trading config by ID: ${error.message}`);
        }
    }

    /**
     * Obtiene configuración de trading por par de monedas
     * @param {number} idCompany - ID de la empresa
     * @param {number} baseCurrencyId - ID de la moneda base
     * @param {number} quoteCurrencyId - ID de la moneda cotizada
     * @returns {Promise<Object|null>} Configuración de trading o null si no existe
     */
    async getTradingConfigByPair(idCompany, baseCurrencyId, quoteCurrencyId) {
        try {
            const config = await TradingCurrencies.findOne({
                where: {
                    id_company: idCompany,
                    id_currency_base: baseCurrencyId,
                    id_currency_quote: quoteCurrencyId,
                    status: '1'
                },
                include: [
                    {
                        model: Currency,
                        as: 'baseCurrency',
                        attributes: ['code_iso3', 'name', 'id_country']
                    },
                    {
                        model: Currency,
                        as: 'quoteCurrency',
                        attributes: ['code_iso3', 'name', 'id_country']
                    }
                ]
            });

            return config ? config.toJSON() : null;

        } catch (error) {
            throw new Error(`Error getting trading config by pair: ${error.message}`);
        }
    }

    /**
     * Obtiene todos los pares de trading configurados para una empresa
     * @param {number} idCompany - ID de la empresa
     * @returns {Promise<Array>} Lista de pares de trading configurados
     */
    async getAllTradingPairs(idCompany) {
        try {
            const pairs = await TradingCurrencies.findAll({
                where: {
                    id_company: idCompany,
                    status: '1'
                },
                include: [
                    {
                        model: Currency,
                        as: 'baseCurrency',
                        attributes: ['code_iso3', 'name']
                    },
                    {
                        model: Currency,
                        as: 'quoteCurrency',
                        attributes: ['code_iso3', 'name']
                    }
                ],
                order: [
                    ['id_currency_base', 'ASC'],
                    ['id_currency_quote', 'ASC']
                ]
            });

            return pairs.map(pair => pair.toJSON());

        } catch (error) {
            throw new Error(`Error getting all trading pairs: ${error.message}`);
        }
    }

    /**
     * Obtiene bancos disponibles por país
     * @param {number} countryId - ID del país
     * @returns {Promise<Array>} Lista de bancos disponibles
     */
    async getBanksByCountry(countryId) {
        try {
            return await this._getBanksByCountry(countryId);
        } catch (error) {
            throw new Error(`Error getting banks by country: ${error.message}`);
        }
    }

    /**
     * Método privado para obtener bancos por país
     * @private
     * @param {number} countryId - ID del país
     * @returns {Promise<Array>} Lista de bancos
     */
    async _getBanksByCountry(countryId) {
        const bankTrades = await BankTrade.findAll({
            where: {
                id_country: countryId,
                status: 1
            },
            include: [
                {
                    model: Bank,
                    as: 'Bank',
                    attributes: ['id', 'sigla', 'det_name', 'codigo', 'name_pay_binance'],
                    where: { status: '1' }
                }
            ]
        });

        return bankTrades.map(bt => ({
            id: bt.Bank.id,
            sigla: bt.Bank.sigla,
            det_name: bt.Bank.det_name,
            codigo: bt.Bank.codigo,
            name_pay_binance: bt.Bank.name_pay_binance
        }));
    }
}

module.exports = TradingRepositoryImpl;