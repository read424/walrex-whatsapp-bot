/**
 * Factory para crear instancias de WhatsAppWebJsStrategy con todas sus dependencias inyectadas
 * Esta clase pertenece a la capa de infraestructura y es responsable de:
 * - Instanciar las implementaciones concretas de los repositorios
 * - Instanciar los handlers (EventHandler y MessageHandler)
 * - Instanciar el adaptador del logger
 * - Inyectar todas las dependencias en la Strategy
 *
 * Este es el único lugar donde se conoce qué implementaciones concretas usar
 * para la Strategy de WhatsApp.
 */

const WhatsAppWebJsStrategy = require('../adapters/inbound/whatsappWebJsStrategy');
const WhatsAppEventHandler = require('../adapters/inbound/whatsapp/WhatsAppEventHandler');
const WhatsAppMessageHandler = require('../adapters/inbound/whatsapp/WhatsAppMessageHandler');
const StructuredLoggerAdapter = require('../adapters/outbound/logging/StructuredLoggerAdapter');
const ChatServiceFactory = require('./ChatServiceFactory');

class WhatsAppStrategyFactory {
    /**
     * Crea una instancia de WhatsAppWebJsStrategy con todas sus dependencias inyectadas
     * @param {Object} params - Parámetros de configuración
     * @param {Object} params.webSocketAdapter - Adaptador de WebSocket (obligatorio)
     * @param {string} params.connectionId - ID de la conexión (obligatorio)
     * @param {string} params.tenantId - ID del tenant (obligatorio)
     * @returns {WhatsAppWebJsStrategy} - Instancia configurada de WhatsAppWebJsStrategy
     */
    static create({ webSocketAdapter, connectionId, tenantId }) {
        if (!webSocketAdapter || !connectionId || !tenantId) {
            throw new Error('webSocketAdapter, connectionId, and tenantId are required to create WhatsAppWebJsStrategy');
        }

        // Instanciar logger
        const logger = new StructuredLoggerAdapter();

        // Instanciar ChatService usando su factory
        const chatService = ChatServiceFactory.create(webSocketAdapter);

        // Instanciar handlers (ahora usan Active Record directamente para channel_connections)
        const eventHandler = new WhatsAppEventHandler({
            webSocketAdapter,
            logger
        });

        const messageHandler = new WhatsAppMessageHandler({
            chatService,
            logger
        });

        // Crear la Strategy con todas las dependencias inyectadas
        const strategy = new WhatsAppWebJsStrategy({
            eventHandler,
            messageHandler,
            chatService,
            webSocketAdapter,
            logger,
            connectionId,
            tenantId
        });

        logger.info('WhatsAppStrategyFactory', 'WhatsAppWebJsStrategy created successfully', {
            connectionId,
            tenantId
        });

        return strategy;
    }
}

module.exports = WhatsAppStrategyFactory;