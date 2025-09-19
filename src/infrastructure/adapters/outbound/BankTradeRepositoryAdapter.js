const structuredLogger = require('../../config/StructuredLogger');
const BankTrade = require('../../models/bankTrade.model');
const Country = require('../../models/country.model');
const Bank = require('../../models/bank.model');

/**
 * Adaptador de repositorio para BankTrade
 * Sigue la arquitectura hexagonal - Capa de infraestructura
 * Implementa BankTradeRepositoryPort usando Sequelize
 */
class BankTradeRepositoryAdapter {
    async getPaymentMethodsByCurrencyCode(currencyIso3) {
        try {
            structuredLogger.info('BankTradeRepositoryAdapter', 'Getting payment methods by currency code', { currencyIso3 });
            const country = await Country.findOne({ where: { code_iso3: currencyIso3.substring(0,2) }, attributes: ['id'] });
            if (!country) return [];
            return this.getPaymentMethodsByCountry(country.id);
        } catch (error) {
            structuredLogger.error('BankTradeRepositoryAdapter', 'Error getting payment methods by currency code', error, { currencyIso3 });
            throw error;
        }
    }
    /**
     * Obtiene los métodos de pago disponibles para un país
     * @param {number} countryId - ID del país
     * @returns {Promise<Array>} Lista de métodos de pago
     */
    async getPaymentMethodsByCountry(countryId) {
        try {
            structuredLogger.info('BankTradeRepositoryAdapter', 'Getting payment methods by country', {
                countryId
            });

            const paymentMethods = await BankTrade.findAll({
                where: {
                    id_country: countryId,
                    status: 1
                },
                include: [
                    {
                        model: Country,
                        as: 'Country',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Bank,
                        as: 'Bank',
                        attributes: ['id', 'name', 'code']
                    }
                ],
                order: [['create_at', 'DESC']]
            });

            const result = paymentMethods.map(method => ({
                id: method.id,
                countryId: method.id_country,
                bankId: method.id_bank,
                userId: method.id_user,
                status: method.status,
                country: method.Country,
                bank: method.Bank,
                createAt: method.create_at
            }));

            structuredLogger.info('BankTradeRepositoryAdapter', 'Payment methods by country retrieved', {
                countryId,
                count: result.length
            });

            return result;

        } catch (error) {
            structuredLogger.error('BankTradeRepositoryAdapter', 'Error getting payment methods by country', error, {
                countryId
            });
            throw error;
        }
    }

    /**
     * Obtiene todos los métodos de pago activos
     * @returns {Promise<Array>} Lista de todos los métodos de pago activos
     */
    async getAllActivePaymentMethods() {
        try {
            structuredLogger.info('BankTradeRepositoryAdapter', 'Getting all active payment methods');

            const paymentMethods = await BankTrade.findAll({
                where: {
                    status: 1
                },
                include: [
                    {
                        model: Country,
                        as: 'Country',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Bank,
                        as: 'Bank',
                        attributes: ['id', 'name', 'code']
                    }
                ],
                order: [['create_at', 'DESC']]
            });

            const result = paymentMethods.map(method => ({
                id: method.id,
                countryId: method.id_country,
                bankId: method.id_bank,
                userId: method.id_user,
                status: method.status,
                country: method.Country,
                bank: method.Bank,
                createAt: method.create_at
            }));

            structuredLogger.info('BankTradeRepositoryAdapter', 'All active payment methods retrieved', {
                count: result.length
            });

            return result;

        } catch (error) {
            structuredLogger.error('BankTradeRepositoryAdapter', 'Error getting all active payment methods', error);
            throw error;
        }
    }

    /**
     * Obtiene métodos de pago por usuario
     * @param {number} userId - ID del usuario
     * @returns {Promise<Array>} Lista de métodos de pago del usuario
     */
    async getPaymentMethodsByUser(userId) {
        try {
            structuredLogger.info('BankTradeRepositoryAdapter', 'Getting payment methods by user', {
                userId
            });

            const paymentMethods = await BankTrade.findAll({
                where: {
                    id_user: userId,
                    status: 1
                },
                include: [
                    {
                        model: Country,
                        as: 'Country',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Bank,
                        as: 'Bank',
                        attributes: ['id', 'name', 'code']
                    }
                ],
                order: [['create_at', 'DESC']]
            });

            const result = paymentMethods.map(method => ({
                id: method.id,
                countryId: method.id_country,
                bankId: method.id_bank,
                userId: method.id_user,
                status: method.status,
                country: method.Country,
                bank: method.Bank,
                createAt: method.create_at
            }));

            structuredLogger.info('BankTradeRepositoryAdapter', 'Payment methods by user retrieved', {
                userId,
                count: result.length
            });

            return result;

        } catch (error) {
            structuredLogger.error('BankTradeRepositoryAdapter', 'Error getting payment methods by user', error, {
                userId
            });
            throw error;
        }
    }

    /**
     * Crea un nuevo método de pago
     * @param {Object} bankTradeData - Datos del método de pago
     * @returns {Promise<Object>} Método de pago creado
     */
    async createPaymentMethod(bankTradeData) {
        try {
            structuredLogger.info('BankTradeRepositoryAdapter', 'Creating payment method', {
                countryId: bankTradeData.id_country,
                bankId: bankTradeData.id_bank,
                userId: bankTradeData.id_user
            });

            const newPaymentMethod = await BankTrade.create({
                id_country: bankTradeData.id_country,
                id_bank: bankTradeData.id_bank,
                status: bankTradeData.status || 1,
                id_user: bankTradeData.id_user,
                create_at: new Date(),
                update_at: new Date()
            });

            const result = {
                id: newPaymentMethod.id,
                countryId: newPaymentMethod.id_country,
                bankId: newPaymentMethod.id_bank,
                userId: newPaymentMethod.id_user,
                status: newPaymentMethod.status,
                createAt: newPaymentMethod.create_at,
                updateAt: newPaymentMethod.update_at
            };

            structuredLogger.info('BankTradeRepositoryAdapter', 'Payment method created successfully', {
                id: result.id,
                countryId: result.countryId,
                bankId: result.bankId
            });

            return result;

        } catch (error) {
            structuredLogger.error('BankTradeRepositoryAdapter', 'Error creating payment method', error, {
                countryId: bankTradeData?.id_country,
                bankId: bankTradeData?.id_bank,
                userId: bankTradeData?.id_user
            });
            throw error;
        }
    }
}

module.exports = BankTradeRepositoryAdapter; 