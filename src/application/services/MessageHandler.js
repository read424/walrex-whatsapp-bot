const structuredLogger = require('../../infrastructure/config/StructuredLogger');
const cacheManager = require('../../infrastructure/config/CacheManager');
const { MENU_TYPES, MESSAGE_TYPES, ACTIONS } = require('../../domain/constants/WhatsAppConstants');
const { interpolate, unicodeToEmoji } = require('../../utils/index');

class MessageHandler {
    constructor(
        sessionManager,
        menuManager,
        registrationProcessor,
        referralManager,
        useCases
    ) {
        // Logger ya no necesario, usando structuredLogger directamente
        this.sessionManager = sessionManager;
        this.menuManager = menuManager;
        this.registrationProcessor = registrationProcessor;
        this.referralManager = referralManager;
        this.useCases = useCases;
        this.whatsappClient = null;
    }

    /**
     * Maneja un mensaje entrante
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleMessage(message) {
        const startTime = Date.now();
        const phoneNumber = message.from;
        
        structuredLogger.info('MessageHandler', 'Handling incoming message', {
            phoneNumber,
            messageType: message.type,
            messageLength: message.body?.length || 0,
            messageBody: message.body?.substring(0, 50) + '...',
            action: 'handle_message'
        });

        try {
            // Verificar si es un mensaje de referido
            if (this.isReferralMessage(message.body)) {
                await this.handleReferralMessage(phoneNumber, message);
                structuredLogger.performance('MessageHandler', 'handleMessage_referral', Date.now() - startTime, {
                    phoneNumber
                });
                return;
            }

            // Obtener o crear sesión de chat
            const chatSession = await this.getOrCreateChatSession(phoneNumber);
            const chatMessage = await this.saveChatMessage(phoneNumber, message.body, chatSession.id);

            // Manejar el mensaje según el tipo de sesión
            await this.processMessageBySessionType(phoneNumber, message, chatSession, chatMessage);

            structuredLogger.performance('MessageHandler', 'handleMessage_success', Date.now() - startTime, {
                phoneNumber,
                sessionId: chatSession.id,
                messageId: chatMessage.id
            });

        } catch (error) {
            structuredLogger.error('MessageHandler', 'Error handling message', error, {
                phoneNumber,
                messageBody: message.body
            });
            throw error;
        }
    }

    /**
     * Verifica si es un mensaje relacionado con referidos
     * @param {string} messageBody - Cuerpo del mensaje
     * @returns {boolean} - True si es un mensaje de referido
     */
    isReferralMessage(messageBody) {
        const lowerMessage = messageBody.toLowerCase();
        return lowerMessage.includes('obtener mi enlace de referido') || 
               lowerMessage.startsWith('he sido referido por');
    }

    /**
     * Maneja mensajes relacionados con referidos
     * @param {string} phoneNumber - Número de teléfono
     * @param {Object} message - Mensaje completo
     */
    async handleReferralMessage(phoneNumber, message) {
        structuredLogger.info('MessageHandler', `Handling referral message from: ${phoneNumber}`);

        // Obtener sesión de chat
        const chatSession = await this.getOrCreateChatSession(phoneNumber);
        const chatMessage = await this.saveChatMessage(phoneNumber, message.body, chatSession.id);

        if (message.body.toLowerCase().includes('obtener mi enlace de referido')) {
            await this.referralManager.processReferralRequest(phoneNumber, chatSession.id, chatMessage.id, null);
        } else if (message.body.toLowerCase().startsWith('he sido referido por')) {
            await this.referralManager.processReferredBy(phoneNumber, message.body, chatSession.id, chatMessage.id);
        }
    }

    /**
     * Procesa el mensaje según el tipo de sesión
     * @param {string} phoneNumber - Número de teléfono
     * @param {Object} message - Mensaje completo
     * @param {Object} chatSession - Sesión de chat
     * @param {Object} chatMessage - Mensaje de chat
     */
    async processMessageBySessionType(phoneNumber, message, chatSession, chatMessage) {
        const session = this.sessionManager.getSession(phoneNumber);

        if (session.stage === 'registration') {
            await this.handleRegistrationMessage(phoneNumber, message, session);
        } else {
            await this.handleChatBotSession(phoneNumber, message);
        }
    }

    /**
     * Maneja mensajes de registro
     * @param {string} phoneNumber - Número de teléfono
     * @param {Object} message - Mensaje completo
     * @param {Object} session - Sesión del usuario
     */
    async handleRegistrationMessage(phoneNumber, message, session) {
        structuredLogger.info('MessageHandler', `Handling registration message for: ${phoneNumber}, stage: ${session.stage}`);

        const response = await this.registrationProcessor.processRegistrationMessage(phoneNumber, message, session);
        
        if (response && response !== '') {
            await this.whatsappClient.sendMessage(phoneNumber, response);
        }
    }

    /**
     * Maneja sesiones de chatbot
     * @param {string} phoneNumber - Número de teléfono
     * @param {Object} message - Mensaje completo
     */
    async handleChatBotSession(phoneNumber, message) {
        structuredLogger.info('MessageHandler', `Handling chatbot session for: ${phoneNumber}`, {
            messageBody: message.body?.substring(0, 50) + '...'
        });

        const session = this.sessionManager.getSession(phoneNumber);
        structuredLogger.info('MessageHandler', `Session retrieved`, {
            phoneNumber,
            sessionStage: session.stage,
            currentMenu: session.currentMenu,
            hasMenu: !!session.menu
        });
        
        let responseMessage = '';

        if (!session.currentMenu) {
            // Inicializar menú principal
            structuredLogger.info('MessageHandler', `Initializing main menu for: ${phoneNumber}`);
            session.currentMenu = 'mainMenu';
            session.menu = this.menuManager.getMenu('mainMenu');
            const textMenu = this.menuManager.getMenu('mainMenu').text;
            responseMessage = await interpolate(textMenu, { name_client: 'amig@' });
            structuredLogger.info('MessageHandler', `Main menu initialized`, {
                phoneNumber,
                responseLength: responseMessage.length,
                responsePreview: responseMessage.substring(0, 100) + '...'
            });
        } else {
            // Procesar menú actual
            responseMessage = await this.processCurrentMenu(session, message);
        }

        // Enviar respuesta (solo una vez)
        if (responseMessage !== '') {
            structuredLogger.info('MessageHandler', `Preparing to send response`, {
                phoneNumber,
                responseLength: responseMessage.length,
                hasWhatsAppClient: !!this.whatsappClient
            });
            
            try {
                // Intentar enviar el mensaje una sola vez
                await this.whatsappClient.sendMessage(phoneNumber, responseMessage);
                structuredLogger.info('MessageHandler', 'Response sent successfully', {
                    phoneNumber,
                    responseLength: responseMessage.length
                });
            } catch (error) {
                structuredLogger.error('MessageHandler', 'Failed to send response', {
                    phoneNumber,
                    responseLength: responseMessage.length,
                    error: error.message
                });
                // No reintentar para evitar envíos múltiples
            }
        }
    }

    /**
     * Procesa el menú actual
     * @param {Object} session - Sesión del usuario
     * @param {Object} message - Mensaje completo
     * @returns {string} - Mensaje de respuesta
     */
    async processCurrentMenu(session, message) {
        const currentMenu = session.menu || this.menuManager.getMenu(session.currentMenu);
        const menuType = currentMenu.type || '';
        const selectedOption = message.body.trim(); // Mantener como string

        structuredLogger.info('MessageHandler', `Processing menu: ${session.currentMenu}, type: ${menuType}, option: ${selectedOption}`);

        switch (menuType) {
            case MENU_TYPES.MENU:
                return await this.processMenuType(session, currentMenu, selectedOption);
            case MENU_TYPES.PROMPT:
                return await this.processPromptType(session, currentMenu, selectedOption);
            case MENU_TYPES.FORM:
                return await this.processFormType(session, currentMenu, message);
            default:
                return '⚠️ Opción inválida. Por favor, selecciona una opción válida.';
        }
    }

    /**
     * Procesa menús de tipo MENU
     * @param {Object} session - Sesión del usuario
     * @param {Object} currentMenu - Menú actual
     * @param {string} selectedOption - Opción seleccionada
     * @returns {string} - Mensaje de respuesta
     */
    async processMenuType(session, currentMenu, selectedOption) {
        structuredLogger.info('MessageHandler', 'Processing menu type', {
            currentMenu: session.currentMenu,
            selectedOption,
            menuType: currentMenu.type
        });

        if (!this.menuManager.isValidOption(session.currentMenu, selectedOption)) {
            const validOptions = this.menuManager.getValidOptions(session.currentMenu);
            structuredLogger.warn('MessageHandler', 'Invalid option selected', {
                currentMenu: session.currentMenu,
                selectedOption,
                validOptions
            });
            return `⚠️ Opción inválida. Por favor, responde con un número del menú [${validOptions.join(',')}] válidos`;
        }

        const optionConfig = this.menuManager.getOptionConfig(session.currentMenu, selectedOption);
        structuredLogger.info('MessageHandler', 'Option config retrieved', {
            currentMenu: session.currentMenu,
            selectedOption,
            optionConfig: {
                text: !!optionConfig.text,
                action: optionConfig.action,
                next: optionConfig.next
            }
        });

        let responseMessage = '';

        // Procesar texto
        if (optionConfig.text) {
            const args = optionConfig.arguments || {};
            responseMessage = await interpolate(optionConfig.text, args);
            structuredLogger.info('MessageHandler', 'Text processed', {
                responseLength: responseMessage.length
            });
        }

        // Procesar acciones
        if (optionConfig.action) {
            responseMessage = await this.processAction(session, optionConfig.action);
            structuredLogger.info('MessageHandler', 'Action processed', {
                action: optionConfig.action,
                responseLength: responseMessage.length
            });
        }

        // Procesar siguiente menú
        if (optionConfig.next) {
            session.currentMenu = optionConfig.next;
            structuredLogger.info('MessageHandler', 'Menu updated', {
                newMenu: optionConfig.next
            });
        }

        structuredLogger.info('MessageHandler', 'Menu processing completed', {
            responseLength: responseMessage.length,
            finalMenu: session.currentMenu
        });

        return responseMessage;
    }

    /**
     * Procesa menús de tipo PROMPT
     * @param {Object} session - Sesión del usuario
     * @param {Object} currentMenu - Menú actual
     * @param {string} selectedOption - Opción seleccionada
     * @returns {string} - Mensaje de respuesta
     */
    async processPromptType(session, currentMenu, selectedOption) {
        // Implementar lógica para prompts
        return 'Procesando prompt...';
    }

    /**
     * Procesa menús de tipo FORM
     * @param {Object} session - Sesión del usuario
     * @param {Object} currentMenu - Menú actual
     * @param {Object} message - Mensaje completo
     * @returns {string} - Mensaje de respuesta
     */
    async processFormType(session, currentMenu, message) {
        // Implementar lógica para formularios
        return 'Procesando formulario...';
    }

    /**
     * Procesa acciones específicas
     * @param {Object} session - Sesión del usuario
     * @param {string} action - Acción a ejecutar
     * @returns {string} - Mensaje de respuesta
     */
    async processAction(session, action) {
        switch (action) {
            case ACTIONS.TRADING_CURRENCY:
                return await this.processTradingCurrencyAction(session);
            case ACTIONS.GET_LIST_BENEFICIARIOS:
                return await this.processGetBeneficiariesAction(session);
            default:
                return 'Acción no implementada';
        }
    }

    /**
     * Procesa la acción de trading currency
     * @param {Object} session - Sesión del usuario
     * @returns {string} - Mensaje de respuesta
     */
    async processTradingCurrencyAction(session) {
        const startTime = Date.now();
        
        // Intentar obtener del cache primero
        const cacheKey = 'trading_currencies';
        let traderCurrencies = cacheManager.get(cacheKey);
        
        if (!traderCurrencies) {
            traderCurrencies = await this.useCases.getCurrencyTrader.getListPairTraderCurrency();
            // Cachear por 2 minutos
            cacheManager.set(cacheKey, traderCurrencies, 2 * 60 * 1000);
            
            structuredLogger.performance('MessageHandler', 'processTradingCurrencyAction_cache_miss', Date.now() - startTime);
        } else {
            structuredLogger.performance('MessageHandler', 'processTradingCurrencyAction_cache_hit', Date.now() - startTime);
        }
        
        const itemsTrader = traderCurrencies.map((item, index) => {
            let emojiFlagBase = '';
            let emojiFlagQuote = '';

            if (item.baseCurrency.Country.unicode_flag !== '') {
                const textUnicodeBase = item.baseCurrency.Country.unicode_flag;
                const aUnicodeBase = textUnicodeBase.split(" ");
                emojiFlagBase = unicodeToEmoji(aUnicodeBase);
            }

            if (item.quoteCurrency.Country.unicode_flag !== '') {
                const textUnicodeQuote = item.quoteCurrency.Country.unicode_flag;
                const aUnicodeQuote = textUnicodeQuote.split(" ");
                emojiFlagQuote = unicodeToEmoji(aUnicodeQuote);
            }

            return {
                value: index + 1,
                id: item.id,
                arguments: { 
                    from: `${item.baseCurrency.Country.name_iso}`, 
                    to: `${item.quoteCurrency.Country.name_iso}` 
                },
                text: `${index + 1}.-${item.baseCurrency.Country.name_iso} ${emojiFlagBase} - ${item.quoteCurrency.Country.name_iso} ${emojiFlagQuote} = ${Number(item.mount_price).toFixed(4)}`
            };
        });

        this.menuManager.assignDynamicOptions(session, itemsTrader);
        return itemsTrader.map(item => item.text).join("\n") + "\n0.- Volver al Menu Principal\nIndique el número del menú?";
    }

    /**
     * Procesa la acción de obtener beneficiarios
     * @param {Object} session - Sesión del usuario
     * @returns {string} - Mensaje de respuesta
     */
    async processGetBeneficiariesAction(session) {
        // Implementar lógica para obtener beneficiarios
        return 'Obteniendo beneficiarios...';
    }

    /**
     * Obtiene o crea una sesión de chat
     * @param {string} phoneNumber - Número de teléfono
     * @returns {Object} - Sesión de chat
     */
    async getOrCreateChatSession(phoneNumber) {
        let chatSession = await this.useCases.addChatSession.getEnabledSessionChat(phoneNumber);
        if (!chatSession) {
            chatSession = await this.useCases.addChatSession.addChatSession(phoneNumber);
        }
        return chatSession;
    }

    /**
     * Guarda un mensaje de chat
     * @param {string} phoneNumber - Número de teléfono
     * @param {string} messageBody - Cuerpo del mensaje
     * @param {string} sessionId - ID de la sesión
     * @returns {Object} - Mensaje guardado
     */
    async saveChatMessage(phoneNumber, messageBody, sessionId) {
        return await this.useCases.addChatMessage.addChatMessage(phoneNumber, messageBody, sessionId);
    }

    /**
     * Establece el cliente de WhatsApp
     * @param {Object} whatsappClient - Cliente de WhatsApp
     */
    setWhatsAppClient(whatsappClient) {
        this.whatsappClient = whatsappClient;
        this.registrationProcessor.setWhatsAppClient(whatsappClient);
        this.referralManager.setWhatsAppClient(whatsappClient);
    }
}

module.exports = MessageHandler; 