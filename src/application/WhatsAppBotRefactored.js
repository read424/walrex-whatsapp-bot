const structuredLogger = require('../infrastructure/config/StructuredLogger');
const SessionManager = require('./services/SessionManager');
const MenuManager = require('./services/MenuManager');
const RegistrationProcessor = require('./services/RegistrationProcessor');
const ReferralManager = require('./services/ReferralManager');
const MessageHandler = require('./services/MessageHandler');
const UXService = require('./services/UXService');

class WhatsAppBotRefactored {
    constructor(customerService = null) {
        // Logger ya no necesario, usando structuredLogger directamente
        this.whatsappClient = null;
        
        // Inicializar casos de uso
        this.initializeUseCases();
        
        // Inicializar servicios
        this.initializeServices(customerService);
        
        // Inicializar manejador de mensajes
        this.initializeMessageHandler();
    }

    /**
     * Inicializa los casos de uso
     */
    initializeUseCases() {
        const CheckPhoneNumberUseCase = require('./checkPhoneNumberUseCase');
        const GetSessionPhoneNumberUseCase = require('./getSessionPhoneNumberUseCase');
        const AddChatSessionUseCase = require('./addChatSessionUseCase');
        const AddChatMessageUseCase = require('./addChatMessageUseCase');
        const GetListCurrencyTraderUseCase = require('./getListCurrenyTraderUseCase');
        const GetListBeneficiaryClientUseCase = require('./getListBeneficiaryClientUseCase');

        this.useCases = {
            checkPhoneNumber: new CheckPhoneNumberUseCase(),
            getSessionPhoneNumber: new GetSessionPhoneNumberUseCase(),
            addChatSession: new AddChatSessionUseCase(),
            addChatMessage: new AddChatMessageUseCase(),
            getCurrencyTrader: new GetListCurrencyTraderUseCase(),
            getListBeneficiary: new GetListBeneficiaryClientUseCase()
        };
    }

    /**
     * Inicializa los servicios
     * @param {Object} customerService - Servicio de clientes
     */
    initializeServices(customerService) {
        this.sessionManager = new SessionManager();
        this.menuManager = new MenuManager();
        this.registrationProcessor = new RegistrationProcessor(
            customerService,
            this.useCases.addChatMessage,
            this.useCases.addChatSession
        );
        this.referralManager = new ReferralManager(
            customerService,
            this.useCases.addChatMessage,
            this.useCases.addChatSession
        );
    }

    /**
     * Inicializa el manejador de mensajes
     */
    initializeMessageHandler() {
        this.messageHandler = new MessageHandler(
            this.sessionManager,
            this.menuManager,
            this.registrationProcessor,
            this.referralManager,
            this.useCases
        );
    }

    /**
     * Establece el cliente de WhatsApp
     * @param {Object} clientStrategy - Estrategia del cliente WhatsApp
     */
    setWhatsAppClient(clientStrategy) {
        this.whatsappClient = clientStrategy;
        this.messageHandler.setWhatsAppClient(clientStrategy);
        this.uxService = new UXService(clientStrategy);
        structuredLogger.info('WhatsAppBotRefactored', 'WhatsApp client set successfully');
    }

    /**
     * Maneja un mensaje entrante
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleMessage(message) {
        try {
            structuredLogger.info('WhatsAppBotRefactored', `Handling message from: ${message.from}`, {
                messageBody: message.body?.substring(0, 50) + '...',
                hasMessageHandler: !!this.messageHandler,
                hasWhatsAppClient: !!this.whatsappClient
            });
            await this.messageHandler.handleMessage(message);
        } catch (error) {
            structuredLogger.error('WhatsAppBotRefactored', `Error handling message: ${error.message}`, error, {
                messageFrom: message.from,
                messageBody: message.body?.substring(0, 50) + '...'
            });
            
            // No lanzar el error para evitar que se propague y cause más problemas
            // En su lugar, loggear y continuar
            structuredLogger.warn('WhatsAppBotRefactored', 'Message handling failed, continuing...', {
                messageFrom: message.from
            });
        }
    }

    /**
     * Envía un mensaje
     * @param {string} phoneNumber - Número de teléfono
     * @param {string} message - Mensaje a enviar
     */
    async sendMessage(phoneNumber, message) {
        if (!this.whatsappClient) {
            throw new Error('WhatsApp client not initialized');
        }
        
        try {
            await this.whatsappClient.sendMessage(phoneNumber, message);
            structuredLogger.info('WhatsAppBotRefactored', `Message sent to: ${phoneNumber}`);
        } catch (error) {
            structuredLogger.error('WhatsAppBotRefactored', `Error sending message: ${error.message}`, error);
            throw error;
        }
    }

    /**
     * Envía un mensaje con indicador de escritura
     * @param {string} phoneNumber - Número de teléfono
     * @param {string} message - Mensaje a enviar
     * @param {number} typingDuration - Duración del indicador de escritura
     */
    async sendMessageWithTyping(phoneNumber, message, typingDuration = 2000) {
        if (!this.uxService) {
            throw new Error('UX service not initialized');
        }
        
        try {
            await this.uxService.sendMessageWithTyping(phoneNumber, message, typingDuration);
            structuredLogger.info('WhatsAppBotRefactored', `Message sent with typing to: ${phoneNumber}`);
        } catch (error) {
            structuredLogger.error('WhatsAppBotRefactored', `Error sending message with typing: ${error.message}`, error);
            throw error;
        }
    }

    /**
     * Simula procesamiento de menú con indicador de escritura
     * @param {string} phoneNumber - Número de teléfono
     * @param {Function} messageGenerator - Función que genera el mensaje
     * @param {number} processingTime - Tiempo de procesamiento simulado
     */
    async processMenuWithTyping(phoneNumber, messageGenerator, processingTime = 1500) {
        if (!this.uxService) {
            throw new Error('UX service not initialized');
        }
        
        try {
            await this.uxService.processMenuWithTyping(phoneNumber, messageGenerator, processingTime);
            structuredLogger.info('WhatsAppBotRefactored', `Menu processed with typing for: ${phoneNumber}`);
        } catch (error) {
            structuredLogger.error('WhatsAppBotRefactored', `Error processing menu with typing: ${error.message}`, error);
            throw error;
        }
    }

    /**
     * Obtiene información de un cliente
     * @param {string} phoneNumber - Número de teléfono
     * @returns {Object} - Información del cliente
     */
    async getInfoCustomer(phoneNumber) {
        return await this.useCases.checkPhoneNumber.getCustomerForPhoneNumber(phoneNumber);
    }

    /**
     * Obtiene todas las sesiones activas
     * @returns {Object} - Sesiones activas
     */
    getAllSessions() {
        return this.sessionManager.getAllSessions();
    }

    /**
     * Limpia sesiones expiradas
     */
    cleanupExpiredSessions() {
        this.sessionManager.cleanupExpiredSessions();
    }

    /**
     * Obtiene estadísticas del bot
     * @returns {Object} - Estadísticas
     */
    getStats() {
        const sessions = this.sessionManager.getAllSessions();
        return {
            activeSessions: Object.keys(sessions).length,
            totalSessions: Object.keys(sessions).length,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = WhatsAppBotRefactored; 