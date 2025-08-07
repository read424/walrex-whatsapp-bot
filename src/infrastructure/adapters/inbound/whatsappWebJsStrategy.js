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
                headless: true,
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-extensions',
                    '--no-first-run',
                    '--disable-default-apps'
                ]
            }
        });
        this.isLoggedIn = false;
        this.whatsAppBot = null; // Se inicializará después
        this.currentQR = null; // Para almacenar el QR actual
    }

    async init(){
        try {
            structuredLogger.info('WhatsAppWebJsStrategy', 'Initializing WhatsApp client');
            
            this.client.on('qr', async (qr) => { 
                console.log('\n🔐 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP:');
                console.log('=====================================');
                qrcode.generate(qr, {small: true});
                console.log('=====================================\n');
                
                structuredLogger.info('WhatsAppWebJsStrategy', 'QR Code generated - Session not found', { qrLength: qr.length });
                
                try {
                    const base64Q = await QRCode.toDataURL(qr, {type: 'image/png'});
                    this.currentQR = base64Q; // Almacenar el QR
                    this.webSocketAdapter.emit('qrCode', { qr : base64Q });
                } catch (error) {
                    structuredLogger.error('WhatsAppWebJsStrategy', 'Error generating QR image', error);
                }
            });

            this.client.on('loading_screen', (percent, message) => {
                console.log(`Loading: ${percent}% - ${message}`);
                structuredLogger.info('WhatsAppWebJsStrategy', 'Loading screen', { percent, message });
            });

            this.client.on('qr', (qr) => {
                console.log('QR Code received, waiting for scan...');
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

            this.client.on('disconnected', (reason) => {
                structuredLogger.warn('WhatsAppWebJsStrategy', 'Client disconnected', { reason });
                this.isLoggedIn = false;
            });
            
            this.listenMessages();
            structuredLogger.info('WhatsAppWebJsStrategy', 'About to initialize client');
            
            // Forzar recarga de la página después de un delay
            setTimeout(async () => {
                try {
                    const page = this.client.pupPage;
                    if (page) {
                        await page.reload({ waitUntil: 'networkidle0' });
                        structuredLogger.info('WhatsAppWebJsStrategy', 'Page reloaded');
                    }
                } catch (error) {
                    structuredLogger.warn('WhatsAppWebJsStrategy', 'Failed to reload page', error);
                }
            }, 5000);
            
            await this.client.initialize();
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'Client initialization completed');
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error during initialization', error);
            throw error;
        }
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

    /**
     * Envía mensajes multimedia
     * @param {string} number - Número de teléfono
     * @param {MessageMedia} media - Objeto MessageMedia
     */
    async sendMessageMedia(number, media) {
        try {
            structuredLogger.info('WhatsAppWebJsStrategy', `Sending media message to: ${number}`, {
                mediaType: media?.mimetype || 'unknown',
                mediaSize: media?.data?.length || 0,
                numberFormat: number
            });
            
            // Validar que el número esté en el formato correcto
            if (!number || typeof number !== 'string') {
                throw new Error('Invalid phone number format');
            }
            
            // Asegurar que el número tenga el sufijo @c.us
            const normalizedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
            
            structuredLogger.info('WhatsAppWebJsStrategy', `Normalized phone number`, {
                originalNumber: number,
                normalizedNumber: normalizedNumber
            });
            
            // Validar que el cliente esté inicializado
            if (!this.client) {
                throw new Error('WhatsApp client not initialized');
            }
            
            // Validar que el cliente esté autenticado
            if (!this.isLoggedIn) {
                throw new Error('WhatsApp client not authenticated');
            }
            
            // Usar el número normalizado
            number = normalizedNumber;
            
            if (!media || !media.mimetype || !media.data) {
                throw new Error('Invalid media object provided');
            }
            
            // Intentar envío directo primero (nueva versión de whatsapp-web.js)
            try {
                structuredLogger.info('WhatsAppWebJsStrategy', `Attempting direct media send`);
                await this.client.sendMessage(number, media);
                structuredLogger.info('WhatsAppWebJsStrategy', `Direct media send successful`);
            } catch (directError) {
                structuredLogger.warn('WhatsAppWebJsStrategy', `Direct send failed, trying file method`, {
                    error: directError.message
                });
                
                // Fallback al método de archivo temporal
                const fs = require('fs').promises;
                const path = require('path');
                const os = require('os');
                
                // Crear archivo temporal
                const tempDir = os.tmpdir();
                const filename = media.filename || `temp_${Date.now()}.${media.mimetype.split('/')[1] || 'jpg'}`;
                const tempFilePath = path.join(tempDir, filename);
                
                // Convertir base64 a buffer y escribir archivo
                const buffer = Buffer.from(media.data, 'base64');
                await fs.writeFile(tempFilePath, buffer);
                
                structuredLogger.info('WhatsAppWebJsStrategy', `Temporary file created`, {
                    tempFilePath,
                    fileSize: buffer.length
                });
                
                // Enviar archivo usando el método de archivo
                const chat = await this.client.getChatById(number);
                if (!chat) {
                    throw new Error(`Chat not found for number: ${number}`);
                }
                
                await chat.sendMessage({
                    document: tempFilePath,
                    mimetype: media.mimetype,
                    filename: media.filename || filename
                });
                
                // Limpiar archivo temporal
                try {
                    await fs.unlink(tempFilePath);
                    structuredLogger.info('WhatsAppWebJsStrategy', `Temporary file cleaned up`, { tempFilePath });
                } catch (cleanupError) {
                    structuredLogger.warn('WhatsAppWebJsStrategy', `Failed to cleanup temporary file`, { 
                        tempFilePath, 
                        error: cleanupError.message 
                    });
                }
            }
            
            structuredLogger.info('WhatsAppWebJsStrategy', `Media message sent successfully to: ${number}`);
            
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', `Error sending media message to ${number}`, error, {
                mediaType: media?.mimetype || 'unknown',
                mediaSize: media?.data?.length || 0,
                errorStack: error.stack
            });
            throw error;
        }
    }

    async listenMessages() {
        structuredLogger.info('WhatsAppWebJsStrategy', `Setting up message listener`)
        this.client.on('message', async message => {
            structuredLogger.info('WhatsAppWebJsStrategy', `Raw message received`, {
                messageFrom: message.from,
                messageBody: message.body,
                messageType: message.type,
                timestamp: new Date().toISOString()
            });
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
        structuredLogger.info('WhatsAppWebJsStrategy', `handleIncomingMessage called`, {
            messageFrom: message.from,
            messageBody: message.body,
            hasWhatsAppBot: !!this.whatsAppBot
        });
        
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

    // Método para reconectar el cliente
    async reconnect() {
        try {
            structuredLogger.info('WhatsAppWebJsStrategy', 'Starting reconnection process');
            
            // Cerrar el cliente actual si existe
            if (this.client) {
                structuredLogger.info('WhatsAppWebJsStrategy', 'Closing current client');
                await this.client.destroy();
                this.client = null;
                this.isLoggedIn = false;
            }
            
            // Crear un nuevo cliente
            structuredLogger.info('WhatsAppWebJsStrategy', 'Creating new client');
            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: path.join(__dirname, '../../../session-whatsappweb'),
                    clientId: 'client-wallrex'
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox', 
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--no-first-run',
                        '--no-zygote'
                    ]
                }
            });
            
            // Reinicializar el cliente
            structuredLogger.info('WhatsAppWebJsStrategy', 'Reinitializing client');
            await this.init();
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'Reconnection process completed');
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error during reconnection', error);
            throw error;
        }
    }
}

module.exports = WhatsAppWebJsStrategy;