const { Client, LocalAuth } = require('whatsapp-web.js');
const WhatsAppBotRefactored = require('../../../application/WhatsAppBotRefactored');
const WhatsAppAdministrator = require('../../../application/WhatsAppAdministrator');
const qrcode = require('qrcode-terminal');
const QRCode = require("qrcode")
const structuredLogger = require('../../config/StructuredLogger');
const { PHONE_PATTERNS } = require('../../../domain/constants/WhatsAppConstants');
const path = require('path');
const fs = require('fs').promises;
const CustomerService = require('../outbound/customerService');
const TradingAdapter = require('../outbound/TradingAdapter');
// Logger ya no necesario, usando structuredLogger directamente

const WhatsAppInterface = require('../../../../whatsAppInterface');

// Importar el modelo de conexiones
const { WhatsAppConnection } = require('../../../models/index');

class WhatsAppWebJsStrategy extends WhatsAppInterface {

    constructor(webSocket, connectionName = 'client-wallrex', tenantId = null) {
        super();
        this.webSocketAdapter = webSocket;
        this.clientId = connectionName;
        this.tenantId = tenantId;
        this.isLoggedIn = false;
        this.whatsAppBot = null; // Se inicializará después
        this.whatsAppAdmin = null; // Se inicializará después
        this.currentQR = null; // Para almacenar el QR actual
        this.connectionRecord = null; // Registro en la base de datos
        this.sessionPath = path.join(__dirname, '../../../sessions', this.clientId);
    }

    async init(){
        try {
            structuredLogger.info('WhatsAppWebJsStrategy', 'Initializing WhatsApp client', {
                clientId: this.clientId,
                tenantId: this.tenantId
            });

            // 1. Buscar o crear registro en la base de datos
            await this.ensureConnectionRecord();

            // 2. Crear cliente de WhatsApp
            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: this.sessionPath,
                    clientId: this.clientId
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
            
            // 3. Configurar event listeners
            await this.setupEventListeners();
            
            // 4. Actualizar estado en BD
            await this.updateConnectionStatus('connecting');

            structuredLogger.info('WhatsAppWebJsStrategy', 'About to initialize client', {
                clientId: this.clientId
            });
            
            // 5. Inicializar cliente
            await this.client.initialize();
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'Client initialization completed', {
                clientId: this.clientId
            });
            
        } catch (error) {
            await this.updateConnectionStatus('error', error.message);
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error during initialization', error, {
                clientId: this.clientId
            });
            throw error;
        }
    }

    async ensureConnectionRecord(){
        try {
            this.connectionRecord = await WhatsAppConnection.getConnectionByClientId(this.clientId);

            if(!this.connectionRecord){
                //crear nuevo registro
                this.connectionRecord = await WhatsAppConnection.create({
                    clientId: this.clientId,
                    tenantId: this.tenantId,
                    status: 'disconnected',
                    settings: {
                        autoReconnect: true,
                        maxConnectionAttempts: 3
                    }
                });

                structuredLogger.info('WhatsAppWebJsStrategy', 'New connection record created', {
                    clientId: this.clientId,
                    tenantId: this.tenantId
                });
            }else{
                structuredLogger.info('WhatsAppWebJsStrategy', 'Existing connection record found', {
                    clientId: this.clientId,
                    connectionId: this.connectionRecord.id,
                    lastStatus: this.connectionRecord.status
                });
            }

            await this.connectionRecord.incrementConnectionAttempts();
        }catch(error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error ensuring connection record', error, {
                clientId: this.clientId
            });
            throw error;
        }
    }

    async setupEventListeners() {

        this.client.on('qr', async (qr) => { 

            qrcode.generate(qr, {small: true});
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'QR Code generated - Session not found', { 
                clientId: this.clientId,
                qrLength: qr.length
            });
            
            try {
                const base64Q = await QRCode.toDataURL(qr, {type: 'image/png'});
                this.currentQR = base64Q;
                console.log('QR Code generated: ', base64Q);

                // Emitir QR específicamente al tenant
                this.webSocketAdapter.emitQRToTenant(this.tenantId, { 
                    qr: base64Q, 
                    clientId: this.clientId
                });
            } catch (error) {
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error generating QR image', error);
            }
        });

        this.client.on('ready', async () => {
            console.log('WhatsApp event ready');
            this.isLoggedIn = true;
            this.currentQR = null;

            const deviceInfo = await this.getDeviceInfo();

            //Actualizar registro en la base de datos
            await this.updateConnectionStatus('authenticated');
            await this.updateConnectionRecord({
                qrCode: null,
                deviceInfo: deviceInfo,
                phoneNumber: deviceInfo?.phoneNumber || null
            });
            await this.connectionRecord.resetConnectionAttempts();

            await this.saveSessionData();

            structuredLogger.info('WhatsAppWebJsStrategy', 'WhatsApp client ready', {
                clientId: this.clientId,
                phoneNumber: deviceInfo?.phoneNumber || null,
            });

            if (!this.whatsAppBot) {
                const CustomerService = require('../outbound/customerService');
                this.whatsAppBot = new WhatsAppBotRefactored(new CustomerService());
                this.whatsAppBot.setWhatsAppClient(this);
            }

            // Emitir estado de conexión al tenant específico
            //this.webSocketAdapter.emitConnectionStatusToTenant(this.tenantId, {
            //    status: 'ready',
            //    clientId: this.clientId,
            //    phoneNumber: deviceInfo?.phoneNumber || null,
            //    message: 'WhatsApp is ready'
            //});

            this.webSocketAdapter.emitToTenant(this.tenantId, 'whatsappReady', {
                clientId: this.clientId,
                tenantId: this.tenantId,
                phoneNumber: deviceInfo?.phoneNumber || null,
                timestamp: new Date().toISOString()
            });
        });

        this.client.on('authenticated', async (session) => {
            console.log('WhatsApp event authenticated');
            await this.updateConnectionStatus('connected');
            structuredLogger.info('WhatsAppWebJsStrategy', 'Session authenticated successfully', {
                clientId: this.clientId,
            });

            await this.saveSessionData();

            this.webSocketAdapter.emitToTenant(this.tenantId, 'authenticated', {});
        });

        this.client.on('auth_failure', async (msg) => {
            console.log('WhatsApp event auth_failure');
            await this.updateConnectionStatus('error', msg);

            structuredLogger.error('WhatsAppWebJsStrategy', 'Authentication failed', null, { 
                clientId: this.clientId,
                message: msg 
            });

            await this.clearSession();
        });

        this.client.on('disconnected', async (reason) => {
            console.log('WhatsApp event disconnected');
            this.isLoggedIn = false;
            await this.updateConnectionStatus('disconnected', reason);

            structuredLogger.warn('WhatsAppWebJsStrategy', 'Client disconnected', {
                clientId: this.clientId,
                reason: reason
             });

             // Emitir desconexión al tenant específico
             this.webSocketAdapter.emitConnectionStatusToTenant(this.tenantId, {
                status: 'disconnected',
                clientId: this.clientId,
                reason: reason,
                message: 'WhatsApp disconnected'
            });

            // Notificar por WebSocket (mantener compatibilidad)
            //this.webSocketAdapter.emit('whatsappDisconnected', {
            //    clientId: this.clientId,
            //    tenantId: this.tenantId,
            //    reason: reason,
            //    timestamp: new Date().toISOString()
            //});
        });

        //Pantalla de carga
        this.client.on('loading_screen', (percent, message) => {
            console.log('WhatsApp event loading_screen');
            structuredLogger.info('WhatsAppWebJsStrategy', 'Loading screen', { 
                clientId: this.clientId,
                percent,
                message
            });

            this.webSocketAdapter.emitToTenant(this.tenantId, 'loading_screen', {percent, message});
        });

        this.listenMessages();
    }

    async clearSession(){
        try {
            if(await this.fileExists(this.sessionPath)){
                await fs.rmdir(this.sessionPath, { recursive: true });
                structuredLogger.info('WhatsAppWebJsStrategy', 'Session data cleared', {
                    clientId: this.clientId
                });
            }

            //Limpiar datos de session en la base de datos
            await this.updateConnectionRecord({
                sessionData: null,
                qrCode: null,
                phoneNumber: null,
                deviceInfo: null
            });

            structuredLogger.info('WhatsAppWebJsStrategy', 'Session data cleared', {
                clientId: this.clientId
            });
        }catch (error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error clearing session', error, {
                clientId: this.clientId
            });
        }
    }

    async saveSessionData(){
        try {
            if(!this.client) return;

            const sessionDataPath = path.join(this.sessionPath, 'session.json');

            if(await this.fileExists(sessionDataPath)){
                const sessionData = await fs.readFile(sessionDataPath, 'utf8');
                await this.updateConnectionRecord({
                    sessionData: sessionData
                });

                structuredLogger.info('WhatsAppWebJsStrategy', 'Session data loaded from file', {
                    clientId: this.clientId
                });
            }
        }catch (error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error saving session data', error, {
                clientId: this.clientId
            });            
        }
    }

    async updateConnectionStatus(status, error = null){
        try {
            if(this.connectionRecord){
                await this.connectionRecord.updateStatus(status, error);
                structuredLogger.info('WhatsAppWebJsStrategy', 'Connection status updated', {
                    clientId: this.clientId,
                    status: status,
                    error: error
                });
            }
        } catch(error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error updating connection status', error);
        }
    }

    async getDeviceInfo() {
        try {
            if (!this.client) return null;

            const info = await this.client.info;

            return {
                phoneNumber: info?.wid?.user || null,
                platform: info?.platform || 'unknown',
                deviceModel: info?.phone?.device_model || 'unknown',
                osVersion: info?.phone?.os_version || 'unknown',
                waVersion: info?.phone?.wa_version || 'unknown',
                battery: info?.battery || null,
                connected: info?.connected || false
            };
        }catch(error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error getting device info', error);
            return null;
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

    async restoreSessionData(){
        try {

            if(!this.connectionRecord) {
                structuredLogger.warn('WhatsAppWebJsStrategy', 'No connection record found for session restoration', {
                    clientId: this.clientId
                });
                return;
            }

            if (!this.connectionRecord.sessionData){
                structuredLogger.info('WhatsAppWebJsStrategy', 'No session data found in database', {
                    clientId: this.clientId
                });
                return;
            }

            structuredLogger.info('WhatsAppWebJsStrategy', 'Restoring session data from database', {
                clientId: this.clientId,
                sessionDataLength: this.connectionRecord.sessionData.length
            });

            await this.ensureSessionDirectory();

            const sessionFilePath = path.join(this.sessionPath, 'session.json');
            await fs.writeFile(sessionFilePath, this.connectionRecord.sessionData, 'utf8');

            structuredLogger.info('WhatsAppWebJsStrategy', 'Session data restored to file system', {
                clientId: this.clientId,
                sessionFilePath
            });

        }catch (error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error restoring session data', error, {
                clientId: this.clientId
            });

            await this.clearSession();
        }
    }

    async ensureSessionDirectory() {
        try {
            await fs.mkdir(this.sessionPath, { recursive: true });
            structuredLogger.debug('WhatsAppWebJsStrategy', 'Session directory ensured', {
                sessionPath: this.sessionPath
            });
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error creating session directory', error, {
                sessionPath: this.sessionPath
            });
            throw error;
        }
    }

    /**
     * Verifica si un archivo existe
    */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
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
                    (!message.from.includes('51913061289@c.us') && !message.from.includes('51935926562@c.us'))) {
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
            hasWhatsAppBot: !!this.whatsAppBot,
            isAdminMessage: message.from.includes('51935926562@c.us')
        });
        
        try{
            // Determinar si es un mensaje de administrador
            const isAdminMessage = message.from.includes('51935926562@c.us');
            
            if (isAdminMessage) {
                // Manejar mensaje de administrador
                if (!this.whatsAppAdmin) {
                    structuredLogger.info('WhatsAppWebJsStrategy', 'Initializing WhatsAppAdministrator for admin message', {
                        messageFrom: message.from
                    });
                    
                    // Crear instancia de TradingAdapter con dependencias
                    const ExchangeRateRepositoryAdapter = require('../outbound/ExchangeRateRepositoryAdapter');
                    const BinanceAPIAdapter = require('../outbound/BinanceAPIAdapter');
                    const exchangeRateRepository = new ExchangeRateRepositoryAdapter();
                    const binanceApi = new BinanceAPIAdapter();
                    const tradingAdapter = new TradingAdapter(exchangeRateRepository, binanceApi);
                    
                    this.whatsAppAdmin = new WhatsAppAdministrator(new CustomerService(), tradingAdapter);
                    this.whatsAppAdmin.setWhatsAppClient(this);
                }
                await this.whatsAppAdmin.handleMessage(message);
            } else {
                // Manejar mensaje de usuario normal
                if (!this.whatsAppBot) {
                    structuredLogger.warn('WhatsAppWebJsStrategy', 'WhatsAppBot not initialized yet, initializing now', {
                        messageFrom: message.from
                    });
                    
                    this.whatsAppBot = new WhatsAppBotRefactored(new CustomerService());
                    this.whatsAppBot.setWhatsAppClient(this);
                }
                await this.whatsAppBot.handleMessage(message);
            }
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
            hasWhatsAppBot: !!this.whatsAppBot,
            hasWhatsAppAdmin: !!this.whatsAppAdmin
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

            // Limpiar sesión
            await this.clearSession();
            
            // Reinicializar el cliente
            structuredLogger.info('WhatsAppWebJsStrategy', 'Reinitializing client');
            await this.init();
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'Reconnection process completed');
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error during reconnection', error);
            throw error;
        }
    }

    async updateConnectionRecord(updateData){
        try {
            if(!this.connectionRecord){ 
                structuredLogger.warn('WhatsAppWebJsStrategy', 'Connection record not found', {
                    clientId: this.clientId
                });
                return;
            }

            //Actualizar solo los campos proporcionados
            await this.connectionRecord.updateStatus(updateData);

            structuredLogger.info('WhatsAppWebJsStrategy', 'Connection record updated', {
                clientId: this.clientId,
                updateData: updateData
            });

        }catch (error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error updating connection record', error, {    
                clientId: this.clientId
            });
            throw error;
        }
    }
}

module.exports = WhatsAppWebJsStrategy;