/**
 * WhatsAppBot Refactorizado
 *
 * Responsabilidades:
 * - Coordinar el flujo de mensajes del bot
 * - Delegar a componentes especializados
 * - Mantener compatibilidad con código existente
 *
 * Mejoras aplicadas:
 * - Configuración de menús separada
 * - Gestión de sesiones delegada a SessionManager
 * - Código más limpio y mantenible
 */

const structuredLogger = require('../infrastructure/config/StructuredLogger');
const moment = require('moment');
const { UUIDUtil, normalizePhoneNumber, isOfLegalAge, getCountryCode, interpolate, unicodeToEmoji } = require('../utils/index');
const { isValidEmail } = require('../utils/index');

// Configuración y servicios
const { MENUS } = require('../infrastructure/config/WhatsAppBotMenuConfig');
const WhatsAppBotSessionManager = require('./services/WhatsAppBotSessionManager');

// Use Cases
const CheckPhoneNumberUseCase = require('./checkPhoneNumberUseCase');
const GetSessionPhoneNumberUseCase = require('./getSessionPhoneNumberUseCase');
const AddChatSessionUseCase = require('./addChatSessionUseCase');
const AddChatMessageUseCase = require('./addChatMessageUseCase');
const GetListCurrencyTraderUseCase = require('./getListCurrenyTraderUseCase');
const GetListBeneficiaryClientUseCase = require('./getListBeneficiaryClientUseCase');

const logger = structuredLogger;

class WhatsAppBot {
    constructor(customerService = null) {
        // Gestión de sesiones delegada
        this.sessionManager = new WhatsAppBotSessionManager();

        // Cliente WhatsApp
        this.whatsappClient = null;

        // Use Cases
        this.checkPhoneNumberUseCase = new CheckPhoneNumberUseCase();
        this.getSessionPhoneNumberUseCase = new GetSessionPhoneNumberUseCase();
        this.addChatSessionUseCase = new AddChatSessionUseCase();
        this.addChatMessageUseCase = new AddChatMessageUseCase();
        this.getCurrencyTrader = new GetListCurrencyTraderUseCase();
        this.getListadoBeneficiary = new GetListBeneficiaryClientUseCase();

        // Services
        this.customerService = customerService;

        // Configuración de menús (desde config separado)
        this.menus = MENUS;
    }

    setWhatsAppClient(clientStrategy) {
        this.whatsappClient = clientStrategy;
    }

    getSession(phoneNumber) {
        return this.sessionManager.getSession(phoneNumber);
    }

    async handleMessage(message) {
        const phoneNumber = message.from;

        // Validar o crear sesión en BD
        let row_session = await this.addChatSessionUseCase.getEnabledSessionChat(normalizePhoneNumber(phoneNumber));
        if (!row_session) {
            row_session = await this.addChatSessionUseCase.addChatSession(normalizePhoneNumber(phoneNumber));
        }

        // Guardar mensaje
        const row_message = await this.addChatMessageUseCase.addChatMessage(
            normalizePhoneNumber(phoneNumber),
            message.body,
            row_session.id
        );

        // Enrutar mensaje según tipo
        if (message.body.toLowerCase().includes("obtener mi enlace de referido")) {
            await this.processReferralRequest(phoneNumber, row_session.id, row_message.id, null);
        } else if (message.body.toLowerCase().startsWith("he sido referido por")) {
            await this.processReferredBy(phoneNumber, message.body, row_session.id, row_message.id);
        } else {
            // Flujo normal del bot
            await this.routeMessage(phoneNumber, message, row_session);
        }
    }

    async routeMessage(phoneNumber, message, row_session) {
        const session = this.sessionManager.getSession(phoneNumber);

        logger.info(`session ${JSON.stringify(this.sessionManager.getAllSessions())}`);

        if (this.sessionManager.hasSession(phoneNumber) && session.stage) {
            // Proceso de registro en curso
            await this.handleRegistrationFlow(session, message);
        } else {
            // Flujo de chatbot con menús
            await this.handleChatBotSession(phoneNumber, message);
        }
    }

    async handleRegistrationFlow(session, message) {
        const message_response = message.body.trim();

        logger.info(`session.stage: `, session.stage);

        switch (session.stage) {
            case 'collecting_dob':
                const is_valid_date = isOfLegalAge(message_response);
                if (!is_valid_date) {
                    session.stage = 'collecting_firstName';
                    this.handleRegistrationProcess(session, message_response, '🗓️ ingresa tu fecha de nacimiento y que seas mayor de edad. Ejm: 31/10/1980');
                    return;
                }
                message.body = moment(message.body, 'DD/MM/YYYY', true);
                break;

            case 'collecting_email':
                const exist_email = await this.customerService.existsEmailUser(message_response);
                const email_format_valid = isValidEmail(message_response);

                if (!email_format_valid || exist_email) {
                    session.stage = 'collecting_dob';
                    const prompt = (!isValidEmail(message_response))
                        ? '✉️ ingresa tu email en un formato válido.'
                        : '✉️ el email ya se encuentra registrado.';
                    this.handleRegistrationProcess(session, message.body, prompt);
                    return;
                }
                break;
        }

        this.handleRegistrationProcess(session, message.body);
    }

    async handleChatBotSession(phoneNumber, message) {
        logger.info(`::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::`);
        logger.info(`handleChatBotSession`);

        const name_client = "amig@";
        const session = this.getSession(normalizePhoneNumber(phoneNumber));
        let response_message = '';

        if (!session.currentMenu) {
            // Primer contacto - mostrar menú principal
            session.currentMenu = 'mainMenu';
            session.menu = this.menus['mainMenu'];
            const text_menu = this.menus['mainMenu'].text;
            response_message = await interpolate(text_menu, { name_client });
        } else {
            // Procesar opción del menú actual
            response_message = await this.processMenuOption(phoneNumber, session, message);
        }

        if (response_message !== '') {
            await this.whatsappClient.sendMessage(phoneNumber, response_message);
        }

        logger.info(`::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::`);
    }

    async processMenuOption(phoneNumber, session, message) {
        const enabled_menu = session.menu;
        const current_menu = enabled_menu || this.menus[session.currentMenu];
        const type_options = (current_menu.hasOwnProperty('type')) ? current_menu.type : '';

        logger.info(`currentMenu: ${session.currentMenu}`);
        logger.info(`current_menu: ${JSON.stringify(current_menu)}`);
        logger.info(`type_items: ${type_options}`);
        logger.info(`message: ${message.body}`);

        let response_message = '';
        var opciones_validas = "0";

        switch (type_options) {
            case 'menu':
                response_message = await this.processMenuType(phoneNumber, session, message, current_menu);
                break;

            case 'prompt':
                // Lógica de prompt si es necesario
                break;

            case 'form':
                response_message = await this.processFormType(session, message, current_menu);
                break;

            default:
                response_message = `⚠️ Opción inválida. Por favor, responde con un número del menu ${opciones_validas}`;
                break;
        }

        return response_message;
    }

    async processMenuType(phoneNumber, session, message, current_menu) {
        const selectedOption = parseInt(message.body, 10);
        const validate_options_menu = (current_menu.hasOwnProperty("options"));

        logger.info(`selectedOption: ${selectedOption}`);

        if (!validate_options_menu || !current_menu.options[selectedOption]) {
            let opciones_validas = "0";
            if (validate_options_menu) {
                opciones_validas = Object.keys(current_menu.options).join(',');
            }
            return `⚠️ Opción inválida. Por favor, responde con un número del menú [${opciones_validas}] válidos`;
        }

        let tmp_menu = {};

        if (this.menus[session.currentMenu].hasOwnProperty('options')) {
            tmp_menu = this.menus[session.currentMenu].options[selectedOption];
        } else {
            tmp_menu = session.menu.options[selectedOption];
        }

        let response_message = '';

        if (tmp_menu.hasOwnProperty('text')) {
            response_message = tmp_menu.text;
        }

        // Manejar acciones dinámicas
        if (tmp_menu.hasOwnProperty('action')) {
            response_message = await this.handleMenuAction(phoneNumber, tmp_menu, session);
        }

        if (tmp_menu.hasOwnProperty('next')) {
            session.currentMenu = tmp_menu.next;
        }

        if (tmp_menu.hasOwnProperty('type') && tmp_menu.type == 'prompt') {
            if (tmp_menu.hasOwnProperty('field')) {
                session.saveDataForm(tmp_menu.field, tmp_menu.id);
            }
            if (tmp_menu.hasOwnProperty('next')) {
                session.menu = this.menus[tmp_menu.next];
                const input_display = this.menus[tmp_menu.next].current_input;
                response_message = `${this.menus[tmp_menu.next].input[input_display].text}`;
            }
        }

        return response_message;
    }

    async handleMenuAction(phoneNumber, tmp_menu, session) {
        let a_items_trader = [];
        let response_message = '';

        switch (tmp_menu.action) {
            case 'trading_currency':
                const lista_currency = await this.getCurrencyTrader.getTradingCurrency();
                a_items_trader = lista_currency.map((item, index) => {
                    let emoji_flag_base = '';
                    let emoji_flag_quote = '';

                    if (item.baseCurrency.Country.unicode_flag != '') {
                        const text_unicode_base = item.baseCurrency.Country.unicode_flag;
                        const a_unicode_base = text_unicode_base.split(" ");
                        emoji_flag_base = unicodeToEmoji(a_unicode_base);
                    }
                    if (item.quoteCurrency.Country.unicode_flag != '') {
                        const text_unicode_quote = item.quoteCurrency.Country.unicode_flag;
                        const a_unicode_quote = text_unicode_quote.split(" ");
                        emoji_flag_quote = unicodeToEmoji(a_unicode_quote);
                    }
                    return {
                        value: index + 1,
                        id: item.id,
                        arguments: { from: `${item.baseCurrency.Country.name_iso}`, to: `${item.quoteCurrency.Country.name_iso}` },
                        text: `${index + 1}.-${item.baseCurrency.Country.name_iso} ${emoji_flag_base} - ${item.quoteCurrency.Country.name_iso} ${emoji_flag_quote} = ${Number(item.mount_price).toFixed(4)}`
                    }
                });
                break;

            case 'get_list_beneficiarios':
                const info_customer = await this.getInfoCustomer(phoneNumber);
                logger.info(`${JSON.stringify(info_customer)}`);
                const listBeneficiarios = await this.getListadoBeneficiary.getListBeneficiaryToClient(info_customer.id);
                a_items_trader = listBeneficiarios.map((item, index) => {
                    return {
                        value: index + 1,
                        id: item.id,
                        arguments: { beneficiario: `${item.last_name_benef} ${item.surname_benef}` },
                        text: `${index + 1}.-${item.last_name_benef} ${item.surname_benef} - ${item.type_account.det_name} ${item.bank.sigla}`
                    }
                });
                break;
        }

        session.menu = tmp_menu;
        await this.assignedDynamicMenu(phoneNumber, a_items_trader);
        response_message = a_items_trader.map(item => { return item.text; }).join("\n");
        response_message += "\n0.- Volver al Menu Principal\nIndique el número del menú?";

        return response_message;
    }

    async processFormType(session, message, current_menu) {
        if (!current_menu.hasOwnProperty('input') || !current_menu.hasOwnProperty('current_input')) {
            return '';
        }

        var item_input_form = current_menu.current_input;
        let response_message = '';

        logger.info(`item_input_form: ${item_input_form}`);
        logger.info(`message.body: ${JSON.stringify(message)} `);

        if (current_menu.input[item_input_form].hasOwnProperty('field')) {
            if (current_menu.input[item_input_form].hasOwnProperty('attach_image')) {
                if ((message.type === 'document' || message.type === 'image') && message.hasMedia) {
                    const attachmentData = await message.downloadMedia();
                    session.saveDataForm(current_menu.input[item_input_form].field, attachmentData);
                }
            } else {
                session.saveDataForm(current_menu.input[item_input_form].field, message.body);
            }
        }

        if (current_menu.input[item_input_form].hasOwnProperty('next')) {
            session.currentMenu = current_menu.input[item_input_form].next;
            session.menu = this.menus[session.currentMenu];
            response_message = session.menu.text;
        } else {
            session.menu.current_input = item_input_form + 1;
            response_message = current_menu.input[item_input_form + 1].text;
        }

        return response_message;
    }

    async processReferredBy(phoneNumber, message, sessionId, messageId) {
        const code_refer = message.trim().toLowerCase().replace('he sido referido por', '');
        const codigo_referido = code_refer.trim().toUpperCase();
        const data_customer = await this.customerService.searchUserByReferralCode(codigo_referido);
        const existCode = this.checkReferralCode(data_customer);

        if (existCode) {
            await this.processReferralRequest(phoneNumber, sessionId, messageId, data_customer.id);
        } else {
            await this.processReferralRequest(phoneNumber, sessionId, messageId, null);
        }
    }

    async getInfoCustomer(numberPhone) {
        return await this.customerService.getInfoCustomerByNumberPhone(normalizePhoneNumber(numberPhone));
    }

    async processReferralRequest(numberPhone, sessionId, message_id, userIdReferal) {
        const userSession = this.getSession(numberPhone);
        userSession.startRegistrationProcess();

        const checkPhoneNumber = await this.checkPhoneNumberUseCase.checkPhoneNumber(normalizePhoneNumber(numberPhone));

        if (checkPhoneNumber) {
            const message = `👋 Hola, ya tienes tu cuenta configurada, ahora puedes realizar tus remesas. Ingresa *0* para volver al menú principal`;
            await this.whatsappClient.sendMessage(numberPhone, message);
            return;
        }

        const existReferredCode = (userIdReferal != null);
        userSession.userReferral = userIdReferal;
        const message_referred_user = (existReferredCode)
            ? '✅ Código de referido encontrado. 🎉'
            : '⚠️ Código de referido no encontrado';

        await this.whatsappClient.sendMessage(numberPhone, message_referred_user);

        const firstPrompt = '💬 Iniciemos tu registro\nPara comenzar, por favor ingresa tu nombre(s):';
        await this.collectData(userSession, 'firstName', null, firstPrompt);
    }

    async handleRegistrationProcess(session, message, prompt) {
        const promptMap = {
            'collecting_firstName': { next: 'collecting_lastName', prompt: '📝 Ahora, ingresa tu apellido(s):' },
            'collecting_lastName': { next: 'collecting_dob', prompt: '🗓️ ingresa tu fecha de nacimiento y que seas mayor de edad. Ejm: 31/10/1980' },
            'collecting_dob': { next: 'collecting_email', prompt: '✉️ Ingresa tu email:' },
            'collecting_email': { next: 'collecting_country', prompt: '🌍 Ingresa tu país (PE para Perú, CO para Colombia):' },
            'collecting_country': { next: 'registrationComplete', prompt: null },
        };

        if (prompt) {
            await this.sendMessage(session.phoneNumber, prompt);
            return;
        }

        const currentField = session.stage.replace('collecting_', '');
        session[currentField] = message;

        const next = promptMap[session.stage];
        if (!next) return;

        if (next.next === 'registrationComplete') {
            await this.completeRegistration(session);
        } else {
            await this.collectData(session, next.next.replace('collecting_', ''), null, next.prompt);
        }
    }

    async collectData(session, field, value, nextPrompt) {
        if (value !== null) {
            session[field] = value;
        }

        session.stage = `collecting_${field}`;

        if (nextPrompt) {
            await this.sendMessage(session.phoneNumber, nextPrompt);
        }
    }

    async completeRegistration(session) {
        try {
            await this.customerService.registerCustomer({
                first_name: session.firstName,
                last_name: session.lastName,
                date_of_birth: session.dob,
                email: session.email,
                country: session.country,
                phone_number: normalizePhoneNumber(session.phoneNumber),
                referred_by: session.userReferral
            });

            const successMessage = '🎉 ¡Registro completado exitosamente! Ya puedes realizar tus operaciones.';
            await this.sendMessage(session.phoneNumber, successMessage);

            // Limpiar sesión
            this.sessionManager.clearSession(session.phoneNumber);
        } catch (error) {
            logger.error('Error completing registration', error);
            await this.sendMessage(session.phoneNumber, '❌ Hubo un error al completar tu registro. Por favor intenta nuevamente.');
        }
    }

    async sendMessage(phoneNumber, message) {
        if (this.whatsappClient) {
            await this.whatsappClient.sendMessage(phoneNumber, message);
        }
    }

    async updateResponseSession(sessionId) {
        await this.addChatSessionUseCase.addUpdateStatusSessionChat(sessionId, 'pending_response');
    }

    async assignedDynamicMenu(phoneNumber, list_options) {
        const session = this.getSession(phoneNumber);
        session.dynamicMenu = list_options;
    }

    checkReferralCode(data_customer) {
        return data_customer && data_customer.id;
    }
}

module.exports = WhatsAppBot;