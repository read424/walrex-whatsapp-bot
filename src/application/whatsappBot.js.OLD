const structuredLogger = require('../infrastructure/config/StructuredLogger');
const moment = require('moment');
const { UUIDUtil, normalizePhoneNumber, isOfLegalAge, getCountryCode, interpolate, unicodeToEmoji } = require('../utils/index');
const { isValidEmail } = require('../utils/index');


const UserSession = require('../domain/model/UserSession');
const CheckPhoneNumberUseCase = require('./checkPhoneNumberUseCase');
const GetSessionPhoneNumberUseCase = require('./getSessionPhoneNumberUseCase');
const AddChatSessionUseCase = require('./addChatSessionUseCase');
const AddChatMessageUseCase = require('./addChatMessageUseCase');
const CustomerServicePort = require('./ports/output/CustomerServicePort');
const GetListCurrencyTraderUseCase = require('./getListCurrenyTraderUseCase');
const { response } = require('express');
const GetListBeneficiaryClientUseCase = require('./getListBeneficiaryClientUseCase');

class WhatsAppBot {

    constructor(customerService = null){
        this.session = {};
        this.whatsappClient = null;
        this.checkPhoneNumberUseCase = new CheckPhoneNumberUseCase();
        this.getSessionPhoneNumberUseCase = new GetSessionPhoneNumberUseCase();
        this.addChatSessionUseCase = new AddChatSessionUseCase();
        this.addChatMessageUseCase = new AddChatMessageUseCase();
        this.customerService = customerService;
        this.getCurrencyTrader = new GetListCurrencyTraderUseCase();
        this.getListadoBeneficiary = new GetListBeneficiaryClientUseCase();

        this.menus= {
            mainMenu: {
                type: 'menu',
                text: `Hola! 👋 {$$name_client} soy Wali, bienvenido al asistente virtual de Walrex, estoy aquí para ayudarte a hacer más fácil tus operaciones.\nPor favor, selecciona una opción respondiendo con el número correspondiente:\n1.-Envio de Remesa 💸\n2.-Estatus Operación 📁\n3.-Reclamo 📝\n4.-Tasas\n5.-Nuestras Ctas Bancarias\n6.-Calculadora 🧮\n7.-Registrarse 👤\nPor ejemplo, escribe *1* para realizar una remesa.\nQue opción deseas elegir?`,
                options: {
                    '1': { type: `menu`, next: 'remesasMenu', action:'trading_currency'},//3.-Chile🇨🇱-Venezuela🇻🇪\n text: `1.-Perú🇵🇪-Venezuela🇻🇪\n2.-Colombia🇨🇴-Venezuela🇻🇪\n*.-Volver al Menú Principal`
                    '2': { text: `Ingresar N° Operación🔖\n`, search: 'getInfoOperation'},
                    '3': { text: `1.-Nuevo Reclamo 📝\n2.-Consultar Reclamo 🔍\n`, next: 'reclamoMenu'},
                    '4': { text: `4.-Registrarse 👤\n`},
                    '5': { text: `1.-Enviar a: 📤\n2.- Recibir en: 📥`}
                }
            }, 
            remesasMenu: {
                type: 'prompt',
                text: `Su remesa será desde {$$from} hacia {$$to}\nEscriba 0 para volver al Menu Principal`, 
                next: `formRemesa`,
                stage: 'initial',
                field: 'id_trader'
            },
            formRemesa: {
                type: 'form',
                current_input:1,
                input: {
                    '1': { text: `Indique la cantidad depositada`, field: 'amount', stage:'amount_deposit'},
                    '2': { next: 'menuBeneficiario', text: `Subir imagen del deposito y/o transferencia`, attach_image:true, field: 'img_deposit', stage: 'image_deposit'},
                }
            },
            menuBeneficiario:{ 
                type:'menu', text: `1.-Listar Beneficiarios\n2.-Otro Beneficiario\n0.-Volver al Menu Principal`, 
                options: {
                    '1': { type: `menu`, next: 'finishRemesa', action: 'get_list_beneficiarios'},
                    '2': { next: 'formBeneficiario'},
                }
            },
            finishRemesa: {
                type: 'prompt',
                field: 'id_beneficiario',
                stage: 'assigned_beneficiario',
                text: `Gracias por preferirnos, en ⏱️ minutos le haremos llegar el 💵 a {$$beneficiario} y 📣 recibiras la confirmación de la operación `
            },
            formBeneficiario:{
                type: 'form',
                current_input: 1,
                input: {
                    '1': { text: `Nombre(s) del Beneficiario`, field: 'name_beneficiario', stage: 'name_beneficiario'},
                    '2': { text: `Apellido(s) del Beneficiario`, field: 'apellido_beneficiario', stage: 'apellido_beneficiario'},
                    '3': { text: `Doc Identidad del Beneficiario`, field: 'dni_beneficiario', stage: 'dni_beneficiario'},
                    '4': { action: `get_list_banks`, field: 'id_bank', stage: 'id_bank'},
                    '5': { text: `Número de Cuenta`, field: 'number_account', stage:'complete'},
                }
            },
            reclamoMenu: {
                text: ``
            }
        };
    }

    setWhatsAppClient(clientStrategy) {
        this.whatsappClient = clientStrategy; // Almacena la instancia del cliente strategy
    }    

    getSession(phoneNumber){
        if(!this.session[phoneNumber]){
            this.session[phoneNumber] = new UserSession(phoneNumber);
        }
        return this.session[phoneNumber];
    }

    async handleMessage(message){
        const phoneNumber = message.from;
        //validar si existe una sesion actual - solo se considera una sesion valida si ended_at es null o no excede a 10 minutos
        let row_session = await this.addChatSessionUseCase.getEnabledSessionChat(normalizePhoneNumber(phoneNumber));
        if(!row_session)
            row_session = await this.addChatSessionUseCase.addChatSession(normalizePhoneNumber(phoneNumber));
        const row_message = await this.addChatMessageUseCase.addChatMessage(normalizePhoneNumber(phoneNumber), message.body, row_session.id);
        if(message.body.toLowerCase().includes("obtener mi enlace de referido")){
            await this.processReferralRequest(phoneNumber, row_session.id, row_message.id, null);
        }else if(message.body.toLowerCase().startsWith("he sido referido por")){
            await this.processReferredBy(phoneNumber, message.body, row_session.id, row_message.id)
        }else{
            //si hay session activa se continua con el proceso de registro
            logger.info(`session ${JSON.stringify(this.session)}`);
            if(this.session[phoneNumber]){
                const message_response = message.body.trim();
                logger.info(`session.stage: `, this.session[phoneNumber].stage);
                switch(this.session[phoneNumber].stage){
                    case 'collecting_dob':
                        const is_valid_date=isOfLegalAge(message_response)
                        if(!is_valid_date){
                            this.session[phoneNumber].stage='collecting_firstName'
                            this.handleRegistrationProcess(this.session[phoneNumber], message_response, '🗓️ ingresa tu fecha de nacimiento y que seas mayor de edad. Ejm: 31/10/1980');
                            return;
                        }
                        message.body = moment(message.body, 'DD/MM/YYYY', true);
                        break; 
                    case 'collecting_email':
                        const exist_email = await this.customerService.existsEmailUser(message_response);
                        const email_format_valid = isValidEmail(message_response);
                        if(!email_format_valid || exist_email){
                            this.session[phoneNumber].stage = 'collecting_dob';
                            const prompt = (!isValidEmail(message_response))?'✉️ ingresa tu email en un formato válido.':'✉️ el email ya se encuentra registrado.';
                            this.handleRegistrationProcess(this.session[phoneNumber], message.body, prompt);
                            return;
                        }
                        break;
                }
                this.handleRegistrationProcess(this.session[phoneNumber], message.body);
            }else{
                await this.handleChatBotSession(phoneNumber, message);
            }
        }
    }

    async handleChatBotSession(phoneNumber, message){
        logger.info(`::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::`);
        logger.info(`handleChatBotSession`);
        const name_client="amig@";
        const session = this.getSession(normalizePhoneNumber(phoneNumber));
        let response_message=''; 
        if(!session.currentMenu){
            session.currentMenu = 'mainMenu' ;
            session.menu = this.menus['mainMenu'];
            const text_menu = this.menus['mainMenu'].text;
            response_message = await interpolate(text_menu, { name_client });
        }else{
            const enabled_menu = session.menu;
            logger.info(`currentMenu: ${session.currentMenu}`);//remesasMenu
            const current_menu=enabled_menu || this.menus[session.currentMenu];//
            logger.info(`current_menu: ${JSON.stringify(current_menu)}`);
            logger.info(`enabled_menu_user: ${JSON.stringify(enabled_menu)}`);
            const type_options=(current_menu.hasOwnProperty('type'))?current_menu.type:'';
            logger.info(`type_items: ${type_options}`)
            logger.info(`message: ${message.body}`);//2
            var opciones_validas="0";
            switch(type_options){
                case 'menu':
                    const selectedOption = parseInt(message.body, 10);
                    const validate_options_menu = (current_menu.hasOwnProperty("options"));
                    logger.info(`selectedOption: ${selectedOption}`);//2
                    if(!validate_options_menu || !current_menu.options[selectedOption]){
                        if(validate_options_menu)
                            opciones_validas = Object.keys(current_menu.options).join(',');
                        response_message=`⚠️ Opción inválida. Por favor, responde con un número del menú [${opciones_validas}] válidos`;
                        break;
                    }
                    let tmp_menu={};
                    logger.info(`${JSON.stringify(current_menu)} -> ${current_menu.hasOwnProperty('options')}`)
                    if(this.menus[session.currentMenu].hasOwnProperty('options')){//No tiene options 
                        tmp_menu=this.menus[session.currentMenu].options[selectedOption];
                    }else{
                        tmp_menu=this.menus[session.currentMenu];//el menu original 
                    }
                    logger.info(`tmp_menu: ${JSON.stringify(tmp_menu)}`)
                    if(tmp_menu.hasOwnProperty('text')){
                        const a_arguments=(current_menu.options[selectedOption].hasOwnProperty('arguments'))?current_menu.options[selectedOption].arguments:{};
                        response_message=await interpolate(tmp_menu.text, a_arguments);
                    }
                    if(tmp_menu.hasOwnProperty('action')){
                        let a_items_trader=[];
                        logger.info(`tmp_menu.action ${tmp_menu.action}`);
                        switch(tmp_menu.action){
                            case 'trading_currency':
                                const trader_currencies = await this.getCurrencyTrader.getListPairTraderCurrency();
                                a_items_trader = trader_currencies.map((item, index)=>{
                                    let emoji_flag_base='';
                                    let emoji_flag_quote='';
                                    if(item.baseCurrency.Country.unicode_flag!=''){
                                        const text_unicode_base=item.baseCurrency.Country.unicode_flag;
                                        const a_unicode_base=text_unicode_base.split(" ");
                                        emoji_flag_base=unicodeToEmoji(a_unicode_base);
                                    }
                                    if(item.quoteCurrency.Country.unicode_flag!=''){
                                        const text_unicode_quote=item.quoteCurrency.Country.unicode_flag;
                                        const a_unicode_quote=text_unicode_quote.split(" ");
                                        emoji_flag_quote=unicodeToEmoji(a_unicode_quote);
                                    }
                                    return {
                                        value: index+1,
                                        id: item.id, 
                                        arguments:{ from: `${item.baseCurrency.Country.name_iso}`, to: `${item.quoteCurrency.Country.name_iso}` },
                                        text: `${index+1}.-${item.baseCurrency.Country.name_iso} ${emoji_flag_base} - ${item.quoteCurrency.Country.name_iso} ${emoji_flag_quote} = ${Number(item.mount_price).toFixed(4)}`
                                    }
                                });
                            break;
                            case 'get_list_beneficiarios':
                                const info_customer= await this.getInfoCustomer(phoneNumber);
                                logger.info(`${JSON.stringify(info_customer)}`);
                                const listBeneficiarios = await this.getListadoBeneficiary.getListBeneficiaryToClient(info_customer.id);
                                a_items_trader = listBeneficiarios.map((item, index)=>{
                                    return {
                                        value: index+1,
                                        id: item.id, 
                                        arguments:{ beneficiario: `${item.last_name_benef} ${item.surname_benef}`},
                                        text: `${index+1}.-${item.last_name_benef} ${item.surname_benef} - ${item.type_account.det_name} ${item.bank.sigla}`
                                    }
                                });
                            break;
                        }
                        session.menu=tmp_menu;
                        logger.info(`action:: tmp_menu: ${JSON.stringify(tmp_menu)}`);
                        logger.info(`action:: current_menu: ${JSON.stringify(current_menu)}`);
                        await this.assignedDynamicMenu(phoneNumber, a_items_trader);
                        response_message=a_items_trader.map(item => { return item.text; }).join("\n");
                        response_message+="\n0.- Volver al Menu Principal\nIndique el número del menú?";
                    }
                    if(tmp_menu.hasOwnProperty('next')){
                        session.currentMenu = tmp_menu.next;//remesasMenu
                    }
                    if(tmp_menu.hasOwnProperty('type') && tmp_menu.type=='prompt'){
                        // if(response_message!=''){
                        //     await this.whatsappClient.sendMessage(phoneNumber, response_message);
                        // }
                        if(tmp_menu.hasOwnProperty('field')){
                            session.saveDataForm(tmp_menu.field, tmp_menu.id);
                        }
                        if(tmp_menu.hasOwnProperty('next')){
                            session.menu=this.menus[tmp_menu.next];
                            const input_display=this.menus[tmp_menu.next].current_input;
                            response_message=`${this.menus[tmp_menu.next].input[input_display].text}`;                        
                        }
                    }
                break;
                case 'prompt':
                break;
                case 'form':
                    if(!current_menu.hasOwnProperty('input') || !current_menu.hasOwnProperty('current_input')){
                        break;
                    }
                    var item_input_form=current_menu.current_input;
                    logger.info(`item_input_form: ${item_input_form}`)
                    logger.info(`message.body: ${JSON.stringify(message)} `);
                    if(current_menu.input[item_input_form].hasOwnProperty('field')){
                        if(current_menu.input[item_input_form].hasOwnProperty('attach_image')){
                            if((message.type === 'document' || message.type === 'image')  && message.hasMedia){
                                const attachmentData = await message.downloadMedia();
                                session.saveDataForm(current_menu.input[item_input_form].field, attachmentData);
                            }
                        }else
                            session.saveDataForm(current_menu.input[item_input_form].field, message.body);
                    }
                    if(current_menu.input[item_input_form].hasOwnProperty('next')){
                        session.currentMenu=current_menu.input[item_input_form].next;
                        logger.info(`this.menus: ${JSON.stringify(this.menus)} currentMenu: ${session.currentMenu}`)
                        session.menu=this.menus[session.currentMenu];
                        response_message=session.menu.text;
                    }else{
                        session.menu.current_input=item_input_form+1;
                        response_message=current_menu.input[item_input_form+1].text;
                    }
                break;
                default:
                    response_message=`⚠️ Opción inválida. Por favor, responde con un número del menu ${opciones_validas}`;
                break; 
            }
        }
        if(response_message!='')
            await this.whatsappClient.sendMessage(phoneNumber, response_message);
        logger.info(`::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::`);
    }

    async processReferredBy(phoneNumber, message, sessionId, messageId){
        const code_refer = message.trim().toLowerCase().replace('he sido referido por', '');
        const codigo_referido =code_refer.trim().toUpperCase();
        const data_customer = await this.customerService.searchUserByReferralCode(codigo_referido);
        const existCode = this.checkReferralCode(data_customer);
        if(existCode){
            await this.processReferralRequest(phoneNumber, sessionId, messageId, data_customer.id);
        }else{
            await this.processReferralRequest(phoneNumber, sessionId, messageId, null);
        }
    }

    async getInfoCustomer(numberPhone){
        return await this.checkPhoneNumberUseCase.getCustomerForPhoneNumber(numberPhone);
    }

    async processReferralRequest(numberPhone, sessionId, message_id, userIdReferal){
        const data_customer = await this.getInfoCustomer(numberPhone);
        const phoneNumber=normalizePhoneNumber(numberPhone);
        if(!data_customer){
            const session = this.getSession(numberPhone);
            session.session_id = sessionId;
            session.message_id = message_id;
            session.data.id_user_referal = userIdReferal;
            await this.handleRegistrationProcess(session, null);
            if(this.session[numberPhone].stage==='initial')
                this.session[numberPhone].stage = 'collecting_lastName';
        }else{
            const mensaje_referido=`He sido referido por ${data_customer.code_refer}.`;
            const linkReferido=`https://wa.me/51914301824/?text=${encodeURIComponent(mensaje_referido)}`;
            await this.whatsappClient.sendMessage(phoneNumber, `Comparte tu enlace de referido con tus amigos y gana 5$. ${linkReferido}`);
        }
    }

    async handleRegistrationProcess(session, message, prompt){
        switch(session.stage){
            case 'initial':
                this.collectData(session, undefined, message, prompt || '✍️ ingresa tus Apellidos.');
                break;
            case 'collecting_lastName':
                this.collectData(session, 'firstLastName', message, prompt || '✍️ ingresa tus Nombres.');
                break;
            case 'collecting_firstName':
                this.collectData(session, 'Names', message, prompt || '🗓️ ingresa tu Fecha de Nacimiento (DD/MM/AAAA).');
                break;
            case 'collecting_dob':
                this.collectData(session, 'DateBirth', message, prompt || '✉️ ingresa tu Email.');
                break;
            case 'collecting_email':
                this.collectData(session, 'Email', message);
                break;
            case 'completed':
                logger.info(`session: `, session);
                await this.sendMessage(session.phoneNumber, 'Ya has sido registrado. Gracias.');
                break;
        }        
    }

    async collectData(session, field, value, nextPrompt){
        if(field!==undefined){
            session.saveData(field, value);
        }
        if (session.stage !== 'completed'){
            await this.addChatMessageUseCase.addChatMessageResponse(session.phoneNumber, nextPrompt, session.session_id, undefined);
            await this.addChatSessionUseCase.updateChatSessionResponse(session.session_id);
            await this.sendMessage(session.phoneNumber, nextPrompt);//
        }else{
            session.data.referralCode = this.generateReferralCode();
            session.data.id_country_phone = getCountryCode(session.phoneNumber);
            session.data.DateBirth = moment(session.data.DateBirth, 'DD/MM/YYYY', true).format('YYYY-MM-DD');
            session.data['Phone']=normalizePhoneNumber(session.phoneNumber);
            //crear cliente y usuario 
            const saved_customer = await this.customerService.create(session.data, session.data.referralCode);
            const mensaje_referido=`He sido referido por ${session.data.referralCode}.`;
            const linkReferido=`https://wa.me/51914301824/?text=${encodeURIComponent(mensaje_referido)}`;
            await this.whatsappClient.sendMessage(session.phoneNumber, `Comparte tu enlace de referido con tus amigos y gana 5$. ${linkReferido}`);
        }
    }

    generateReferralCode() {
        return UUIDUtil.generateReferralCode();
    }

    async sendMessage(phoneNumber, message) {
        // Aquí iría la implementación para enviar mensajes usando la API de WhatsApp
        await this.whatsappClient.sendMessage(phoneNumber, message);
    }

    checkReferralCode(data) {
        // Aquí va la lógica para verificar si el código de referido es válido
        return (data!==null);
    }

    async updateResponseSession(sessionId){

    }

    async assignedDynamicMenu(phoneNumber, list_options){
        const userSession = this.getSession(normalizePhoneNumber(phoneNumber));
        userSession.setMenuOptions(list_options)
    }

    // async handleInitialMessage(session, message) {
    //     if (message.body.toLowerCase() === 'obtener mi enlace de referido') {
    //         session.nextStage();
            
    //     } else{
    //         await this.sendMessage(session.phoneNumber, 'Envía "Obtener mi enlace de referido" para continuar.');
    //     }
    // }
}

module.exports = WhatsAppBot;