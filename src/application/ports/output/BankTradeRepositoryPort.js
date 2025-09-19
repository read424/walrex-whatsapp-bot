/**
 * Puerto de salida para repositorio de BankTrade
 * Sigue la arquitectura hexagonal - Capa de aplicación
 * Define el contrato para acceso a datos de métodos de pago de Binance
 */
class BankTradeRepositoryPort {
    /**
     * Obtiene los métodos de pago disponibles a partir del código de moneda (deriva país)
     * @param {string} currencyIso3 - Código ISO 4217
     * @returns {Promise<Array>} Lista de métodos de pago
     */
    async getPaymentMethodsByCurrencyCode(currencyIso3) {
        throw new Error('getPaymentMethodsByCurrencyCode method must be implemented');
    }
    /**
     * Obtiene los métodos de pago disponibles para un país
     * @param {number} countryId - ID del país
     * @returns {Promise<Array>} Lista de métodos de pago
     * @throws {Error} Si no se puede acceder a la base de datos
     */
    async getPaymentMethodsByCountry(countryId) {
        throw new Error('getPaymentMethodsByCountry method must be implemented');
    }

    /**
     * Obtiene todos los métodos de pago activos
     * @returns {Promise<Array>} Lista de todos los métodos de pago activos
     * @throws {Error} Si no se puede acceder a la base de datos
     */
    async getAllActivePaymentMethods() {
        throw new Error('getAllActivePaymentMethods method must be implemented');
    }

    /**
     * Obtiene métodos de pago por usuario
     * @param {number} userId - ID del usuario
     * @returns {Promise<Array>} Lista de métodos de pago del usuario
     * @throws {Error} Si no se puede acceder a la base de datos
     */
    async getPaymentMethodsByUser(userId) {
        throw new Error('getPaymentMethodsByUser method must be implemented');
    }

    /**
     * Crea un nuevo método de pago
     * @param {Object} bankTradeData - Datos del método de pago
     * @returns {Promise<Object>} Método de pago creado
     * @throws {Error} Si no se puede guardar en la base de datos
     */
    async createPaymentMethod(bankTradeData) {
        throw new Error('createPaymentMethod method must be implemented');
    }
}

module.exports = BankTradeRepositoryPort; 