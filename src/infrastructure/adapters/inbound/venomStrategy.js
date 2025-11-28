const WhatsAppInterface  = require('../../../../whatsAppInterface');
const { WhatsAppBotRefactored } = require('../../../application/WhatsAppBotRefactored');
const venom = require('venom-bot');
const { SESSION_STATUS, PHONE_PATTERNS } = require('../../../domain/constants/WhatsAppConstants');
const fs = require('fs');
const path = require('path');
const sessionFilePath = path.join(__dirname, './../session.json');

/**
 * Estrategia de conexión WhatsApp usando Venom Bot
 * Implementa inversión de dependencias recibiendo el logger mediante DI
 */
class VenomStrategy extends WhatsAppInterface {

    constructor(webSocket, logger) {
        super();
        this.webSocketAdapter = webSocket;
        this.logger = logger;
        this.client = null;
        this.sessionData = null;
        this.whatsAppBot = null; // Se inicializará después
        this.loadSession();
    }

    // Cargar la sesión desde el archivo JSON
    loadSession() {
        if (fs.existsSync(sessionFilePath)) {
            const sessionData = JSON.parse(fs.readFileSync(sessionFilePath, 'utf-8'));
            this.sessionData = sessionData.venom;
        } else {
            // Si el archivo no existe, inicializa el objeto de sesión
            this.sessionData = {
                isLoggedIn: false,
                sessionData: {}
            };
        }
    }    

    async init(){
        if(!this.sessionData.isLoggedIn){
            this.logger.info('VenomStrategy', 'Iniciando sesión nueva de Venom Bot');
            this.client = await venom.create(
                'sessionName',
                (qrcode)=>{
                    this.logger.info('VenomStrategy', 'QR Code generado para escanear con WhatsApp', {
                        qrLength: qrcode.length
                    });
                },
                async (statusSession)=>{
                    this.logger.info('VenomStrategy', 'Estado de la sesión cambiado', {
                        status: statusSession
                    });
                    if(statusSession === SESSION_STATUS.IS_LOGGED){
                        this.sessionData.isLoggedIn = true;
                        await this.saveSession();
                        this.logger.info('VenomStrategy', 'Sesión iniciada correctamente');
                    } else if (statusSession === SESSION_STATUS.NOT_LOGGED) {
                        this.logger.warn('VenomStrategy', 'No se inició sesión correctamente');
                    }
                },
                { headless: 'new', devtools: false }
            );
        }else{
            this.logger.info('VenomStrategy', 'Restaurando sesión existente de Venom Bot');
            this.client = await venom.create(
                'sessionName',
                undefined,
                undefined,
                { headless: 'new' }
            );
        }
        if (!this.whatsAppBot) {
            const CustomerService = require('../outbound/customerService');
            // WhatsAppBotRefactored ya está importado arriba
            this.whatsAppBot = new WhatsAppBotRefactored(new CustomerService());
        }
        this.whatsAppBot.setWhatsAppClient(this);
        this.listenMessages();
        this.logger.info('VenomStrategy', 'VenomStrategy inicializado exitosamente');
    }

    async saveSession() {
        // Guardar la sesión en el archivo session.json
        const sessionData = {
            venom: {
                isLoggedIn: this.sessionData.isLoggedIn,
            }
        }
        fs.writeFileSync(sessionFilePath, JSON.stringify(sessionData, null, 2));
    }

    async sendMessage(number, message){
        await this.client.sendText(number, message);
    }

    async sendMessageTextViaTyping(number, message){
        try{
            await this.client.sendTextViaTyping(number, message);
            this.logger.debug('VenomStrategy', 'Mensaje enviado vía typing', {
                number: number.substring(0, 10) + '...',
                messageLength: message.length
            });
        }catch(error){
            this.logger.error('VenomStrategy', 'Error sending message via typing', error, {
                number: number.substring(0, 10) + '...'
            });
        }
    }

    async sendButtons(number, message, buttons, footer){
        const buttonsT= [
            {
                "buttonText": {
                    "displayText": "Text of Button 1"
                }
            },
            {
                "buttonText": {
                    "displayText": "Text of Button 2"
                }
            }
        ];
        await this.client.sendButtons(number, message, footer, buttonsT)
            .then((result)=>{
                this.logger.info('VenomStrategy', 'Botones enviados exitosamente', {
                    number: number.substring(0, 10) + '...',
                    buttonCount: buttonsT.length
                });
            })
            .catch((erro)=>{
                this.logger.error('VenomStrategy', 'Error al enviar botones', erro, {
                    number: number.substring(0, 10) + '...'
                });
            });
    }

    async listenMessages() {
        await this.client.onMessage(async (message) => {
            if(message.from === PHONE_PATTERNS.STATUS_BROADCAST || message.from.endsWith(PHONE_PATTERNS.GROUP_CHAT_SUFFIX)){
                return true;
            }
            this.logger.debug('VenomStrategy', 'Mensaje recibido', {
                from: message.from.substring(0, 15) + '...',
                bodyLength: message.body?.length || 0
            });
            await this.handleIncomingMessage(message);
        });
    }

    async handleIncomingMessage(message) {
        // Lógica para manejar los mensajes
        this.logger.info('VenomStrategy', 'Procesando mensaje entrante', {
            from: message.from.substring(0, 15) + '...',
            body: message.body?.substring(0, 50) || ''
        });
        await this.whatsAppBot.handleMessage(message);
    }    

    async onMessage(callback){
        this.client.onMessage(callback);
    }

}

module.exports = VenomStrategy;