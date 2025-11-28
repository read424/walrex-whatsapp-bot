/**
 * DEPRECATED: Wrapper legacy para WhatsAppAdministrator
 *
 * Este archivo existe solo para mantener compatibilidad con código legacy.
 * Internamente delega al nuevo WhatsAppAdminCommandAdapter.
 *
 * NO USAR EN CÓDIGO NUEVO.
 * Use WhatsAppAdminCommandAdapter directamente con inyección de dependencias desde CompositionRoot.
 *
 * @deprecated Use WhatsAppAdminCommandAdapter en su lugar
 */

const WhatsAppAdminCommandAdapter = require('../infrastructure/adapters/inbound/whatsapp/WhatsAppAdminCommandAdapter');
const WhatsAppMessageFormatter = require('../infrastructure/adapters/inbound/whatsapp/WhatsAppMessageFormatter');
const GetActivePricesUseCase = require('./usecases/GetActivePricesUseCase');
const GetTradingConfigUseCase = require('./usecases/GetTradingConfigUseCase');

class WhatsAppAdministratorLegacy {
    constructor({ logger, tradingRepository, tradingAdapter, customerService = null }) {
        // Crear casos de uso
        const getActivePricesUseCase = new GetActivePricesUseCase(
            tradingRepository,
            tradingAdapter,
            logger
        );

        const getTradingConfigUseCase = new GetTradingConfigUseCase(
            tradingRepository,
            logger
        );

        // Crear formateador
        const formatter = new WhatsAppMessageFormatter();

        // Delegar al nuevo adaptador
        this.adapter = new WhatsAppAdminCommandAdapter({
            getActivePricesUseCase,
            getTradingConfigUseCase,
            formatter,
            logger
        });

        this.logger = logger;
    }

    setWhatsAppClient(clientStrategy) {
        this.adapter.setWhatsAppClient(clientStrategy);
    }

    async handleMessage(message) {
        await this.adapter.handleMessage(message);
    }
}

module.exports = WhatsAppAdministratorLegacy;