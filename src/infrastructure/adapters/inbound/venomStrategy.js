const WhatsAppInterface  = require('../../../../whatsAppInterface');
const { WhatsAppBotRefactored } = require('../../../application/WhatsAppBotRefactored');
const venom = require('venom-bot');
const structuredLogger = require('../../config/StructuredLogger');
const { SESSION_STATUS, PHONE_PATTERNS } = require('../../../domain/constants/WhatsAppConstants');
// Logger ya no necesario, usando structuredLogger directamente
const fs = require('fs');
const path = require('path');
const sessionFilePath = path.join(__dirname, './../session.json');

class VenomStrategy extends WhatsAppInterface {

    constructor(webSocket) {
        super();
        this.webSocketAdapter = webSocket;
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
            this.client = await venom.create(
                'sessionName',
                (qrcode)=>{
                    console.log('Escanea el siguiente codigo QR para conectarse con Venom Bot:');
                    console.log(qrcode);
                },
                async (statusSession)=>{
                    console.log('Estado de la sesión:', statusSession);
                    if(statusSession === SESSION_STATUS.IS_LOGGED){
                        this.sessionData.isLoggedIn = true;
                        await this.saveSession();
                    } else if (statusSession === SESSION_STATUS.NOT_LOGGED) {
                        console.log('No se inició sesión correctamente.');
                    }
                },
                { headless: 'new', devtools: false }
            );
        }else{
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
        }catch(error){
            console.error('Error sending message: ', error);
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
                console.log('Result: ', result);
            })
            .catch((erro)=>{
                console.error('Error When sending: ', erro);
            });
    }

    async listenMessages() {
        await this.client.onMessage(async (message) => {
            if(message.from === PHONE_PATTERNS.STATUS_BROADCAST || message.from.endsWith(PHONE_PATTERNS.GROUP_CHAT_SUFFIX)){
                return true;
            }    
            console.log(`message.from: ${message.from}`);
            console.log('Message received: ', message.body);
            await this.handleIncomingMessage(message);
        });
    }

    async handleIncomingMessage(message) {
        // Lógica para manejar los mensajes
        console.log(`Received message: ${message.body} from ${message.from}`);
        await this.whatsAppBot.handleMessage(message);
    }    

    async onMessage(callback){
        this.client.onMessage(callback);
    }

}

module.exports = VenomStrategy;