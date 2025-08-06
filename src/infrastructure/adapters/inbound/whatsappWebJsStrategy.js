const { Client, LocalAuth } = require('whatsapp-web.js');
const WhatsAppBotRefactored = require('../../../application/WhatsAppBotRefactored');
const qrcode = require('qrcode-terminal');
const QRCode = require("qrcode")
const structuredLogger = require('../../config/StructuredLogger');
const { PHONE_PATTERNS } = require('../../../domain/constants/WhatsAppConstants');
const path = require('path');
// Logger ya no necesario, usando structuredLogger directamente

const WhatsAppInterface = require('../../../../whatsAppInterface');

class WhatsAppWebJsStrategy extends WhatsAppInterface {

    constructor(webSocket) {
        super();
        this.webSocketAdapter = webSocket;
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(__dirname, '../../../session-whatsappweb'),
                clientId: 'client-wallrex'
            }),
            puppeteer: {
                handleMessage: false,
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });
        this.isLoggedIn = false;
        this.whatsAppBot = null; // Se inicializará después
        this.currentQR = null; // Para almacenar el QR actual
    }

    async init(){
        structuredLogger.info('WhatsAppWebJsStrategy', 'Initializing WhatsApp client');
        
        this.client.on('qr', async (qr) => { 
            console.log('\n🔐 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP:');
            console.log('=====================================');
            qrcode.generate(qr, {small: true});
            console.log('=====================================\n');
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'QR Code generated - Session not found', { qrLength: qr.length });
            const base64Q = await QRCode.toDataURL(qr, {type: 'image/png'});
            this.currentQR = base64Q; // Almacenar el QR
            this.webSocketAdapter.emit('qrCode', { qr : base64Q });
        });

        this.client.on('ready', () => {
            console.log('\n✅ WhatsApp conectado exitosamente!');
            console.log('=====================================\n');
            structuredLogger.info('WhatsAppWebJsStrategy', 'WhatsApp client ready - Session restored');
            this.isLoggedIn = true;
            this.currentQR = null; // Limpiar QR ya que está conectado
            if (!this.whatsAppBot) {
                const CustomerService = require('../outbound/customerService');
                this.whatsAppBot = new WhatsAppBotRefactored(new CustomerService());
            }
            this.whatsAppBot.setWhatsAppClient(this);
        });

        this.client.on('authenticated', (session) => {
            structuredLogger.info('WhatsAppWebJsStrategy', 'Session authenticated successfully');
        });

        this.client.on('auth_failure', (msg) => {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Authentication failed', null, { message: msg });
            console.log('\n❌ Error de autenticación de WhatsApp');
        });
        
        this.listenMessages();
        this.client.initialize();
    }

    async checkSession() {
        // Aquí verificamos si hay sesión activa
        // LocalAuth se encarga de manejar la sesión, pero puedes añadir lógica para verificar
        try {
            const sessionData = await LocalAuth.getSession(); // Obtener los datos de la sesión
            return sessionData !== undefined; // Retorna true si hay sesión
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', `Error al verificar la sesión: ${error}`);
            return false; // Retorna false si no hay sesión
        }
    }    

    async sendMessage(number, message){
        try {
            structuredLogger.info('WhatsAppWebJsStrategy', `Sending message to: ${number}`, {
                messageLength: message?.length || 0,
                messagePreview: message?.substring(0, 50) + '...'
            });
            
            // Validar que el número tenga el formato correcto
            if (!number.includes('@c.us')) {
                number = number + '@c.us';
            }
            
            await this.client.sendMessage(number, message);
            
            structuredLogger.info('WhatsAppWebJsStrategy', `Message sent successfully to: ${number}`);
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', `Error sending message to ${number}`, error, {
                messageLength: message?.length || 0,
                messagePreview: message?.substring(0, 50) + '...'
            });
            
            // No reintentar automáticamente para evitar envíos múltiples
            structuredLogger.warn('WhatsAppWebJsStrategy', 'Message send failed, not retrying', {
                error: error.message,
                phoneNumber: number
            });
            
            // Lanzar el error para que el caller decida qué hacer
            throw error;
        }
    }

    async sendButtons(number, message, buttons, footer){
        try {
            structuredLogger.info('WhatsAppWebJsStrategy', `Sending buttons to: ${number}`, {
                messageLength: message?.length || 0,
                buttonsCount: buttons?.length || 0
            });
            
            // Validar que el número tenga el formato correcto
            if (!number.includes('@c.us')) {
                number = number + '@c.us';
            }
            
            const buttonMessage = {
                text: message,
                footer: footer,
                buttons: buttons,
                headerType: 1
            };
            
            await this.client.sendMessage(number, buttonMessage);
            
            structuredLogger.info('WhatsAppWebJsStrategy', `Buttons sent successfully to: ${number}`);
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', `Error sending buttons to ${number}`, error, {
                messageLength: message?.length || 0,
                buttonsCount: buttons?.length || 0
            });
            throw error;
        }
    }

    async listenMessages() {
        structuredLogger.info('WhatsAppWebJsStrategy', `listenMessages`)
        this.client.on('message', async message => {
            try {
                // Filtrar mensajes no deseados
                if (message.from === PHONE_PATTERNS.STATUS_BROADCAST || 
                    message.from.endsWith(PHONE_PATTERNS.GROUP_CHAT_SUFFIX) || 
                    !message.from.includes('51913061289@c.us')) {
                    structuredLogger.debug('WhatsAppWebJsStrategy', 'Message filtered out', {
                        messageFrom: message.from,
                        reason: 'filtered'
                    });
                    return;
                }
                
                structuredLogger.info('WhatsAppWebJsStrategy', 'Processing incoming message', {
                    messageFrom: message.from,
                    messageBody: message.body?.substring(0, 50) + '...'
                });
                
                // Delegar la lógica al método `handleIncomingMessage`
                await this.handleIncomingMessage(message);
            } catch (error) {
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error in message listener', error, {
                    messageFrom: message.from
                });
            }
        });
    }    

    async handleIncomingMessage(message) {
        console.log(`Received message: ${message.body} from ${message.from}`);
        try{
            // Verificar si whatsAppBot está inicializado
            if (!this.whatsAppBot) {
                structuredLogger.warn('WhatsAppWebJsStrategy', 'WhatsAppBot not initialized yet, initializing now', {
                    messageFrom: message.from
                });
                const CustomerService = require('../outbound/customerService');
                this.whatsAppBot = new WhatsAppBotRefactored(new CustomerService());
                this.whatsAppBot.setWhatsAppClient(this);
            }
            await this.whatsAppBot.handleMessage(message);
        }catch(error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error handling incoming message', error, {
                messageFrom: message.from,
                messageBody: message.body
            });
            
            // No lanzar el error para evitar que se propague
            // Solo loggear y continuar
            structuredLogger.warn('WhatsAppWebJsStrategy', 'Message handling failed, continuing...', {
                messageFrom: message.from
            });
        }
    }    

    async onMessage(callback){
        this.client.on('message_create', callback);
    }

    // Método para obtener el QR actual
    getQRCode() {
        return this.currentQR;
    }

    // Método para verificar el estado del cliente
    isClientReady() {
        return this.client && this.isLoggedIn;
    }

    // Método para obtener el estado del cliente
    getClientStatus() {
        return {
            hasClient: !!this.client,
            isLoggedIn: this.isLoggedIn,
            hasWhatsAppBot: !!this.whatsAppBot
        };
    }
}

module.exports = WhatsAppWebJsStrategy;