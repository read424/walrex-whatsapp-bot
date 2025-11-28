/**
 * Factory para crear instancias de ChatService con todas sus dependencias inyectadas
 * Esta clase pertenece a la capa de infraestructura y es responsable de:
 * - Instanciar las implementaciones concretas de los repositorios
 * - Instanciar el adaptador del logger
 * - Inyectar todas las dependencias en el ChatService
 *
 * Este es el único lugar donde se conoce qué implementaciones concretas usar
 */

const ChatService = require('../../domain/service/ChatService');
const ContactRepositoryImpl = require('../adapters/outbound/persistence/ContactRepositoryImpl');
const ChatSessionRepositoryImpl = require('../adapters/outbound/persistence/ChatSessionRepositoryImpl');
const ChatMessageRepositoryImpl = require('../adapters/outbound/persistence/ChatMessageRepositoryImpl');
const StructuredLoggerAdapter = require('../adapters/outbound/logging/StructuredLoggerAdapter');

class ChatServiceFactory {
    /**
     * Crea una instancia de ChatService con todas sus dependencias inyectadas
     * @param {NotificationPort} notificationService - Servicio de notificaciones (obligatorio)
     * @returns {ChatService} - Instancia configurada de ChatService
     */
    static create(notificationService) {
        if (!notificationService) {
            throw new Error('notificationService is required to create ChatService');
        }

        // Instanciar las implementaciones concretas de los repositorios
        const contactRepository = new ContactRepositoryImpl();
        const chatSessionRepository = new ChatSessionRepositoryImpl();
        const chatMessageRepository = new ChatMessageRepositoryImpl();

        // Instanciar el adaptador del logger
        const logger = new StructuredLoggerAdapter();

        // Inyectar todas las dependencias en el ChatService
        return new ChatService({
            contactRepository,
            chatSessionRepository,
            chatMessageRepository,
            logger,
            notificationService
        });
    }

    /**
     * Crea una instancia de ChatService para testing con dependencias mock
     * @param {Object} mocks - Objetos mock para las dependencias
     * @returns {ChatService} - Instancia configurada de ChatService para testing
     */
    static createForTesting(mocks = {}) {
        return new ChatService({
            contactRepository: mocks.contactRepository || {},
            chatSessionRepository: mocks.chatSessionRepository || {},
            chatMessageRepository: mocks.chatMessageRepository || {},
            logger: mocks.logger || { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
            notificationService: mocks.notificationService || {}
        });
    }
}

module.exports = ChatServiceFactory;