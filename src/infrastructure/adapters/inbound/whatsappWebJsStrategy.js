const { Client, LocalAuth } = require('whatsapp-web.js');
const WhatsAppBotRefactored = require('../../../application/WhatsAppBotRefactored');
const WhatsAppAdministrator = require('../../../application/WhatsAppAdministrator');
const ChatService = require('../../../domain/service/ChatService');
const qrcode = require('qrcode-terminal');
const QRCode = require("qrcode")
const structuredLogger = require('../../config/StructuredLogger');
const { PHONE_PATTERNS } = require('../../../domain/constants/WhatsAppConstants');
const path = require('path');
const fs = require('fs').promises;
const CustomerService = require('../outbound/customerService');
const TradingAdapter = require('../outbound/TradingAdapter');

const WhatsAppInterface = require('../../../../whatsAppInterface');
const { WhatsAppConnection, Connection } = require('../../../models/index');

class WhatsAppWebJsStrategy extends WhatsAppInterface {

    constructor(webSocket, connectionId = null, tenantId = null) {
        super();
        this.webSocketAdapter = webSocket;
        this.connectionId = connectionId;
        this.tenantId = tenantId;
        this.isLoggedIn = false;
        this.isClientReady = false;
        this.sessionBasePath = null;
        this.connectionName = null;
        this.whatsAppBot = null; // Se inicializará después
        this.whatsAppAdmin = null; // Se inicializará después
        this.currentQR = null; // Para almacenar el QR actual
        this.connectionRecord = null; // Registro en la base de datos
        this.connectionWhatsapp = null; // Registro en la base de datos
        
        this.qrAttempts = 0;
        this.maxQrAttempts = 4;
        this.qrTimeout = null;
        this.qrTimeoutDuration = 30000;
        this.isConnectionClosed = false;

        // ChatService
        this.chatService = new ChatService(webSocket);

        this.messageListenerSetup = false;
    }

    configureSessionBasePath(){
        const changeDirectorySession = process.env.CHANGE_DIRECTORY_SESSION === 'true';
        structuredLogger.info('WhatsAppWebJsStrategy', 'Define Session Path', {
            sessionBasePath: this.sessionBasePath,
            isChangeDirectory: changeDirectorySession
        })
        if(!this.sessionBasePath && changeDirectorySession){
            this.sessionBasePath = path.join(__dirname, '../../../sessions');
        }
    }

    async init(){
        try {
            this.configureSessionBasePath();

            structuredLogger.info('WhatsAppWebJsStrategy', 'Initializing WhatsApp client', {
                tenantId: this.tenantId,
                dataPath: this.sessionBasePath
            });

            // 1. Buscar o crear registro en la base de datos
            await this.ensureConnectionRecord();
                        
            structuredLogger.info('WhatsAppWebJsStrategy', 'Creating LocalAuth with parameters', {
                dataPath: this.sessionBasePath,
                connectionName: this.connectionName
            });
            const ignoreRestoreSession = process.env.IGNORE_RESTORE_SESSION === 'true';
            
            const authConfig = ignoreRestoreSession 
                ? {} // Sin parámetros - use la convencion por defecto de whatsapp-web.js
                : { clientId: this.connectionName }; // Con clientId - guarda/restaura sesiones

            structuredLogger.info('WhatsAppWebJsStrategy', 'LocalAuth configuration', {
                connectionId: this.connectionId,
                ignoreRestoreSession,
                authConfig
            });

            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: 'walrex_bot'
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
            await this.updateWhatsAppConnectionRecord({status: 'connecting'});

            structuredLogger.info('WhatsAppWebJsStrategy', 'About to initialize client', {
                connectionId: this.connectionId,
                status: 'connecting'
            });
            
            // 5. Inicializar cliente
            structuredLogger.info('WhatsAppWebJsStrategy', 'Calling client.initialize()', {
                connectionId: this.connectionId
            });
            
            // Aplicar timeout a client.initialize() para evitar caigas
            const initPromise = this.client.initialize();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('TIMEOUT: client.initialize() se colgó después de 30 segundos')), 30000);
            });
            
            try {
                await Promise.race([initPromise, timeoutPromise]);
                structuredLogger.info('WhatsAppWebJsStrategy', 'Client initialization completed', {
                    connectionId: this.connectionId
                });
            } catch (error) {
                if (error.message.includes('TIMEOUT')) {
                    await this.clearSession();
                    await this.client.destroy();
                    this.client=null;
                    structuredLogger.info('WhatsAppWebJsStrategy', 'Retrying initialization with clean session', {
                        connectionId: this.connectionId
                    });
                } else {
                    throw error;
                }
            }
        } catch (error) {
            await this.updateBothConnectionStatuses('error', error.message);
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error during initialization', error, {
                connectionId: this.connectionId
            });
            throw error;
        }
    }

    async ensureConnectionRecord(){
        try {
            this.connectionRecord  = await Connection.findByPk(this.connectionId);
            if(!this.connectionRecord){
                throw new Error('Connection record not found');
            }

            if(!this.connectionName){
                this.connectionName = this.connectionRecord.connection_name;
            }

            structuredLogger.info('WhatsAppWebJsStrategy', 'Finding connection WhatsAppConnection', {
                connectionId: this.connectionId,
                tenantId: this.tenantId
            });
            const connectionWhatsapp = await WhatsAppConnection.findOne({ 
                where: { connectionId: this.connectionId, tenantId: parseInt(this.tenantId).toString(), isActive: true } 
            });
            const status = 'disconnected';
            let recordStatus = 'New';
            if(!connectionWhatsapp){
                //crear nuevo registro
                this.connectionWhatsapp = await WhatsAppConnection.create({
                    tenantId: this.tenantId,
                    connectionId: this.connectionRecord.id,
                    isActive: true,
                    status: status
                });
            }else{
                recordStatus = 'Existing';
                connectionWhatsapp.connectionAttempts=0;
                connectionWhatsapp.qr=null;
                connectionWhatsapp.lastError=null;
                this.connectionWhatsapp = await connectionWhatsapp.save();
            }
            structuredLogger.info('WhatsAppWebJsStrategy', `${recordStatus} connection record created`, {
                connectionId: this.connectionId,
                tenantId: this.tenantId,
                connectionId: this.connectionRecord.id,
                connectionAttempts: 0,
                whatsappConnectionId: this.connectionWhatsapp.id,
                status: status,
                recordStatus: recordStatus
            });
        }catch(error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error ensuring connection record', error, {
                connectionId: this.connectionId
            });
            throw error;
        }
    }

    async setupEventListeners() {

        this.client.on('qr', async (qr) => {
            if(this.isConnectionClosed){
                structuredLogger.info('WhatsAppWebJsStrategy', 'Connection closed, skipping QR processing', {
                    connectionId: this.connectionId
                });
                return;
            }

            // Llamar el método que maneja el timeout
            await this.handleQRTimeout();
            
            // Si se cerró por timeout, no procesar el QR
            if (this.isConnectionClosed) return;


            qrcode.generate(qr, {small: true});
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'QR Code generated - Session not found', { 
                clientId: this.connectionId,
                attempts: this.qrAttempts,
                maxAttempts: this.maxQrAttempts,
                qrLength: qr.length
            });
            
            try {
                const base64Q = await QRCode.toDataURL(qr, {type: 'image/png'});
                this.currentQR = base64Q;

                await this.updateWhatsAppConnectionRecord({
                    qrCode: base64Q,
                });

                // Emitir QR específicamente al tenant
                this.webSocketAdapter.emitQRToTenant(this.connectionId, { 
                    qr: base64Q, 
                    tenantId: this.tenantId,
                    clientId: this.connectionId,
                    attempts: this.qrAttempts,
                    maxAttempts: this.maxQrAttempts
                });

            } catch (error) {
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error generating QR image', error);
            }
        });

        this.client.on('ready', async () => {
            this.isLoggedIn = true;
            this.isClientReady = true;
            this.currentQR = null;

            structuredLogger.info('WhatsAppWebJsStrategy', 'WhatsApp client ready event triggered', {
                connectionId: this.connectionId,
                isLoggedIn: this.isLoggedIn,
                isClientReady: this.isClientReady,
                messageListenerSetup: this.messageListenerSetup
            });

            // Limpiar timeout y reiniciar contadores al conectarse exitosamente
            this.resetQRAttempts();

            const deviceInfo = await this.getDeviceInfo();

            //Actualizar registro en la base de datos
            await this.updateConnectionRecord({status: 'active'})

            await this.updateWhatsAppConnectionRecord({
                status: 'connected',
                qrCode: null,
                deviceInfo: deviceInfo,
                phoneNumber: deviceInfo?.phoneNumber || null,
                lastSeen: new Date()
            });

            
            await this.connectionWhatsapp.resetConnectionAttempts();

            // Session data is automatically managed by whatsapp-web.js

            structuredLogger.info('WhatsAppWebJsStrategy', 'WhatsApp client ready', {
                connectionId: this.connectionId,
                phoneNumber: deviceInfo?.phoneNumber || null,
            });

            if(!this.messageListenerSetup){
                this.setupMessageListeners();
                this.messageListenerSetup = true;
                structuredLogger.info('WhatsAppWebJsStrategy', 'Message listeners set up after ready event', {
                    connectionId: this.connectionId
                });                
            }

            if (!this.whatsAppBot) {
                const CustomerService = require('../outbound/customerService');
                this.whatsAppBot = new WhatsAppBotRefactored(new CustomerService());
                this.whatsAppBot.setWhatsAppClient(this);
                structuredLogger.info('WhatsAppWebJsStrategy', 'WhatsAppBot initialized after ready', {
                    connectionId: this.connectionId
                });                
            }

            // Asegurar que los listeners de mensajes estén configurados
            this.listenMessages();

            // Setup message status listeners
            this.setupMessageStatusListeners();

            this.webSocketAdapter.emitToTenant(this.tenantId, 'whatsappReady', {
                clientId: this.connectionId,
                tenantId: this.tenantId,
                phoneNumber: deviceInfo?.phoneNumber || null,
                timestamp: new Date().toISOString()
            });
        });

        this.client.on('authenticated', async (session) => {
            this.isLoggedIn = true;
            this.isClientReady = true;
            this.resetQRAttempts();
            
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'WhatsApp client authenticated event triggered', {
                connectionId: this.connectionId,
                isLoggedIn: this.isLoggedIn,
                isClientReady: this.isClientReady,
                messageListenerSetup: this.messageListenerSetup
            });
            
            await this.updateBothConnectionStatuses('authenticated');
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'Session authenticated successfully', {
                connectionId: this.connectionId,
            });

            // Configurar listeners de mensajes también en authenticated (por si ready no se dispara)
            if(!this.messageListenerSetup){
                this.setupMessageListeners();
                this.messageListenerSetup = true;
                structuredLogger.info('WhatsAppWebJsStrategy', 'Message listeners set up after authenticated event', {
                    connectionId: this.connectionId
                });                
            }
            

            this.webSocketAdapter.emitToTenant(this.tenantId, 'authenticated', {
                connectionId: this.connectionId,
                tenantId: this.tenantId,
                timestamp: new Date().toISOString()
            });
        });

        this.client.on('auth_failure', async (msg) => {
            await this.updateWhatsAppConnectionRecord({status:'error', lastError: msg});

            structuredLogger.error('WhatsAppWebJsStrategy', 'Authentication failed', null, { 
                connectionId: this.connectionId,
                message: msg 
            });

            await this.clearSession();
        });

        this.client.on('disconnected', async (reason) => {
            this.isLoggedIn = false;
            this.isClientReady = false;
            this.messageListenerSetup = false;

            await this.updateWhatsAppConnectionRecord({status: 'disconnected', lastError: reason });
            await this.updateConnectionStatus({status:'inactive'});

            structuredLogger.warn('WhatsAppWebJsStrategy', 'Client disconnected', {
                connectionId: this.connectionId,
                reason: reason
             });

             // Emitir desconexión al tenant específico
             this.webSocketAdapter.emitConnectionStatusToTenant(this.tenantId, {
                status: 'disconnected',
                clientId: this.connectionId,
                reason: reason,
                message: 'WhatsApp disconnected'
            });
        });

        //Pantalla de carga
        this.client.on('loading_screen', (percent, message) => {
            structuredLogger.info('WhatsAppWebJsStrategy', 'Loading screen', { 
                connectionId: this.connectionId,
                percent,
                message
            });

            this.webSocketAdapter.emitToTenant(this.tenantId, 'loading_screen', {percent, message});
        });

    }

    setupMessageListeners(){
        structuredLogger.info('WhatsAppWebJsStrategy', 'Setting up message listeners', {
            connectionId: this.connectionId,
            isClientReady: this.isClientReady,
            hasClient: !!this.client,
            messageListenerSetup: this.messageListenerSetup
        });

        if (!this.client || !this.isClientReady) {
            structuredLogger.warn('WhatsAppWebJsStrategy', 'Cannot setup message listeners - client not ready', {
                connectionId: this.connectionId,
                hasClient: !!this.client,
                isClientReady: this.isClientReady
            });
            return;
        }
        
        structuredLogger.info('WhatsAppWebJsStrategy', 'Registering message event listener', {
            connectionId: this.connectionId,
            clientEvents: this.client.listenerCount('message')
        });
        
        this.client.on('message', async (message) => {
            structuredLogger.info('WhatsAppWebJsStrategy', 'Raw message received', {
                messageFrom: message.from,
                messageBody: message.body,
                messageType: message.type,
                timestamp: new Date().toISOString(),
                clientId: this.connectionId
            });

            try {
                // Filtrar mensajes no deseados
                if (message.from === PHONE_PATTERNS.STATUS_BROADCAST || 
                    message.from.endsWith(PHONE_PATTERNS.GROUP_CHAT_SUFFIX) || 
                    (!message.from.includes('51913061289@c.us') && !message.from.includes('51935926562@c.us'))) {
                    structuredLogger.debug('WhatsAppWebJsStrategy', 'Message filtered out', {
                        messageFrom: message.from,
                        reason: 'filtered',
                        connectionId: this.connectionId
                    });
                    return;
                }
                
                structuredLogger.info('WhatsAppWebJsStrategy', 'Processing incoming message', {
                    messageFrom: message.from,
                    messageBody: message.body?.substring(0, 50) + '...',
                    connectionId: this.connectionId
                });
                
                // Delegar la lógica al método `handleIncomingMessage`
                await this.handleIncomingMessage(message);
            } catch (error) {
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error in message listener', error, {
                    messageFrom: message.from,
                    connectionId: this.connectionId
                });
            }
        });

        structuredLogger.info('WhatsAppWebJsStrategy', 'Message listener successfully attached', {
            connectionId: this.connectionId,
            totalMessageListeners: this.client.listenerCount('message')
        });        
    }

    // Método para verificar el estado de los listeners (debug)
    getListenerStatus() {
        return {
            clientId: this.connectionId,
            hasClient: !!this.client,
            isClientReady: this.isClientReady,
            messageListenerSetup: this.messageListenerSetup,
            totalMessageListeners: this.client ? this.client.listenerCount('message') : 0,
            isLoggedIn: this.isLoggedIn
        };
    }

    async listenMessages() {
        structuredLogger.info('WhatsAppWebJsStrategy', 'listenMessages called', {
            connectionId: this.connectionId,
            isClientReady: this.isClientReady,
            messageListenerSetup: this.messageListenerSetup
        });


        if (!this.isClientReady) {
            structuredLogger.warn('WhatsAppWebJsStrategy', 'listenMessages called but client not ready yet', {
                    connectionId: this.connectionId
                });
            return;
        }

        if (this.messageListenerSetup) {
            structuredLogger.info('WhatsAppWebJsStrategy', 'Message listeners already set up', {
                connectionId: this.connectionId
            });
            return;
        }

        this.setupMessageListeners();
        this.messageListenerSetup = true;
        structuredLogger.info('WhatsAppWebJsStrategy', 'Message listeners set up via listenMessages method', {
            connectionId: this.connectionId
        });
    }

    async handleIncomingMessage(message) {
        structuredLogger.info('WhatsAppWebJsStrategy', `handleIncomingMessage called`, {
                messageFrom: message.from,
                messageBody: message.body,
                hasWhatsAppBot: !!this.whatsAppBot,
                connectionId: this.connectionId
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

                const chatData = await this.chatService.processIncomingMessage(
                    message, 
                    this.connectionRecord.id, 
                    this.tenantId
                );

                structuredLogger.info('WhatsAppWebJsStrategy', 'Message saved to database', {
                    messageId: chatData.message.id,
                    sessionId: chatData.chatSession.id,
                    contactPhone: chatData.contact.phoneNumber
                });
                
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
            structuredLogger.warn('WhatsAppWebJsStrategy', 'Message handling failed, continuing...', {
                messageFrom: message.from
            });
        }
    }

    setupMessageStatusListeners(){
        if (!this.client || !this.isClientReady) {
            structuredLogger.warn('WhatsAppWebJsStrategy', 'Cannot setup message status listeners - client not ready', {
                    connectionId: this.connectionId
                });
            return;
        }

        this.client.on('message_ack', async (message, ack)=>{
            try{
                let status;
                switch(ack){
                    case 1: status = 1; break;// sent
                    case 2: status = 2; break;// delivered
                    case 3: status = 3; break;// read
                    default: status = 0; break;// sending
                }
                structuredLogger.debug('WhatsAppWebJsStrategy', 'Message status updated', {
                    message: message,
                    messageId: message.id._serialized,
                    status
                });

                await this.chatService.updateChatSessionStatus(message.id.__serialized, status);

            }catch(error){
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error updating message status', error, {
                connectionId: this.connectionId
            });            
        }
        });
    }

    async updateWhatsAppConnectionRecord(data) {
        if (this.connectionWhatsapp) {
            try {
                // Update specific fields in the WhatsAppConnection model
                Object.assign(this.connectionWhatsapp, data);
                await this.connectionWhatsapp.save();
                
                structuredLogger.info('WhatsAppWebJsStrategy', 'WhatsApp connection record updated', {
                    connectionId: this.connectionId,
                    updates: Object.keys(data)
                });
            } catch (error) {
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error updating WhatsApp connection record', error, {
                    connectionId: this.connectionId,
                    data: data
                });
                throw error;
            }
        } else {
            structuredLogger.warn('WhatsAppWebJsStrategy', 'No whatsappconnection record available for update', {
                connectionId: this.connectionId
            });
        }
    }
    
    async updateConnectionRecord(data){
        if (this.connectionRecord) {
            try {
                Object.assign(this.connectionRecord, data);
                await this.connectionRecord.save();
            } catch (error) {
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error updating connection record', error, {
                    connectionId: this.connectionId,
                    data: data
                });
            }
        }else{
            structuredLogger.warn('WhatsAppWebJsStrategy', 'No connection record available for update', {
                connectionId: this.connectionId
            });
            throw new Error('No connection record available for update');
        }
    }

    async updateConnectionStatus(status, error = null){
        if (this.connectionRecord) {
            try {
                await this.connectionRecord.updateStatus(status, error);
                structuredLogger.info('WhatsAppWebJsStrategy', 'Connection status updated', {
                    connectionId: this.connectionId,
                    status: status,
                    error: error
                });
            } catch (updateError) {
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error updating connection status', updateError, {
                    connectionId: this.connectionId,
                    status: status
                });
            }
        }
    }

    async getDeviceInfo() {
        try {
            if (!this.client) return null;

            const info = await this.client.info;

            structuredLogger.info('WhatsAppWebJsStrategy', 'Device info retrieved', info);

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

    async clearSession(){
        try {

            await this.updateWhatsAppConnectionRecord({
                qrCode: null,
                phoneNumber: null,
                deviceInfo: null,
                status: 'disconnected'
            });

            await this.updateConnectionRecord({status: 'inactive'});

            if(!this.connectionName)
                return;

            const authSessionDir = path.join(this.sessionBasePath, `session-${this.connectionName}`);
            
            if (await this.directoryExists(authSessionDir)) {
                await fs.rmdir(authSessionDir, { recursive: true });
                structuredLogger.info('WhatsAppWebJsStrategy', 'LocalAuth session directory cleared', {
                    connectionId: this.connectionId,
                    sessionDir: authSessionDir
                });
            }
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'Session data cleared completely', {
                connectionId: this.connectionId
            });
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error clearing session', error, {
                connectionId: this.connectionId
            });
        }
    }

    async restoreSessionIfExists(connectionName){
        try {
            var sessionPath;//aqui
            if(!this.sessionBasePath){
                sessionPath = path.join(__dirname, `./../../../../.wwebjs_auth/session-${connectionName}`);
            }else{
                sessionPath = path.join(this.sessionBasePath, `session-${connectionName}`);
            }
            const expectedSessionExists = await this.directoryExists(sessionPath);
            structuredLogger.info('WhatsAppWebJsStrategy', 'Expected session directory exists', {
                connectionId: this.connectionId,
                sessionPath: sessionPath,
                expectedSessionExists: expectedSessionExists
            });
            if (expectedSessionExists) {
                const sessionFiles = await fs.readdir(sessionPath).catch(() => []);
                structuredLogger.info('WhatsAppWebJsStrategy', 'Session files found in expected location', {
                    connectionId: this.connectionId,
                    fileCount: sessionFiles.length
                });
                if (sessionFiles.length > 0) {
                    return true; // Sesión válida encontrada
                } else {
                    throw new Error(`Session directory exists but contains no valid session files: ${sessionPath}`);
                }
            } else {
                throw new Error(`Session directory does not exist: ${sessionPath}`);
            }            
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error checking session directory', error, {
                connectionId: this.connectionId,
                connectionName
            });
            throw error;
        }
    }

    async ensureSessionDirectory() {
        try {
            await fs.mkdir(this.sessionBasePath, { recursive: true });
            structuredLogger.debug('WhatsAppWebJsStrategy', 'Session directory ensured', {
                sessionBasePath: this.sessionBasePath
            });
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error creating session directory', error, {
                sessionBasePath: this.sessionBasePath
            });
            throw error;
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    getConnectionState() {
        return {
            clientId: this.connectionId,
            isLoggedIn: this.isLoggedIn,
            isClientReady: this.isClientReady,
            messageListenerSetup: this.messageListenerSetup,
            hasClient: !!this.client,
            hasWhatsAppBot: !!this.whatsAppBot,
            isConnectionClosed: this.isConnectionClosed,
            whatsappConnectionId: this.connectionRecord?.id || null,
            whatsappStatus: this.connectionRecord?.status || 'unknown'
        };
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
            throw error;
        }
    }    

    async onMessage(callback){
        structuredLogger.info('WhatsAppWebJsStrategy', 'onMessage called - delegating to listenMessages', {
            connectionId: this.connectionId
        });        
        await this.listenMessages();
    }

    async sendMessageAndUpdate(number, message, messageType = 'text', advisorId = null){
        try{
            await this.sendMessage(number, message);

            const contact = await this.chatService.findOrCreateContact(
                number.replace('@c.us', ''),
                null,
                this.tenantId
            );

            const chatSession = await this.chatService.findOrCreateChatSession(
                contact.id,
                this.connectionRecord.id,
                this.tenantId
            );

            const outgoingMessage = await this.chatService.sendOutgoingMessage(
                chatSession.id,
                message,
                advisorId,
                messageType
            );

            structuredLogger.info('WhatsAppWebJsStrategy', 'Outgoing message sent and saved', {
                messageId: outgoingMessage.id,
                to: number
            });
    
            return outgoingMessage;

        } catch(error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error sending message and updating DB', error);
            throw error;
        }

    }

    getQRCode() {
        return this.currentQR;
    }

    isClientReady() {
        return this.client && this.isLoggedIn;
    }

    getClientStatus() {
        return {
            hasClient: !!this.client,
            isLoggedIn: this.isLoggedIn,
            hasWhatsAppBot: !!this.whatsAppBot,
            hasWhatsAppAdmin: !!this.whatsAppAdmin
        };
    }

    async handleQRTimeout(){
        this.qrAttempts++;

        structuredLogger.info('WhatsAppWebJsStrategy', 'QR timeout ocurred', {
            connectionId: this.connectionId,
            attempts: this.qrAttempts,
            maxAttempts: this.maxQrAttempts
        });

        if(this.qrAttempts >= this.maxQrAttempts){
            await this.closeConnectionDueToQRTimeout();
        }
    }

    async closeConnectionDueToQRTimeout(){
        try{
            this.isConnectionClosed = true;

            await this.updateWhatsAppConnectionRecord({status:'disconnected', lastError:'QR timeout occurred'});

            if(this.client){
                await this.client.destroy();
                this.client = null;
            }

            this.isLoggedIn = false;
            this.currentQR = null;

            //Emitir evento de timeout al frontend
            this.webSocketAdapter.emitToTenant(this.tenantId, 'qrTimeout', {
                clientId: this.connectionId,
                tenantId: this.tenantId,
                attempts: this.qrAttempts,
                maxAttempts: this.maxQrAttempts,
                message: 'Se alcanzo el maximo de intentos para escanear el QR',
                timestamp: new Date().toISOString()
            });

            structuredLogger.info('WhatsAppWebJsStrategy', 'Connection closed due to QR timeout', {
                connectionId: this.connectionId,
                attempts: this.qrAttempts
            });

        }catch(error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error closing connection due to QR timeout', error, {
                connectionId: this.connectionId,
                attempts: this.qrAttempts
            });
        }
    }

    resetQRAttempts() {
        this.qrAttempts = 0;
        if (this.qrTimeout) {
            clearTimeout(this.qrTimeout);
            this.qrTimeout = null;
        }
        structuredLogger.debug('WhatsAppWebJsStrategy', 'QR attempts reset', {
            connectionId: this.connectionId
        });
    }

    async restartConnection(){
        try {

            structuredLogger.info('WhatsAppWebJsStrategy', 'Restarting connection manually', {
                connectionId: this.connectionId
            });

            this.resetQRAttempts();

            if(this.client){
                await this.client.destroy();
                this.client = null;
            }

            this.isLoggedIn = false;
            this.isClientReady = false;
            this.messageListenerSetup = false;
            this.currentQR = null;

            await this.init();

            structuredLogger.info('WhatsAppWebJsStrategy', 'Connection restarted completed', {
                connectionId: this.connectionId
            });
        }catch(error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error restarting connection', error, {
                connectionId: this.connectionId
            });
            throw error;
        }
    }

    async cleanup(){
        if(this.qrTimeout){
            clearTimeout(this.qrTimeout);
            this.qrTimeout = null;
        }

        if(this.client){
            await this.client.destroy();
            this.client = null;
        }

        this.isLoggedIn = false;
        this.isClientReady = false;
        this.messageListenerSetup = false;        
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

    async logout() {
        if (this.client) {
            await this.client.logout();
        }
    }

    async directoryExists(dirPath) {
        try {
            structuredLogger.info('WhatsAppWebJsStrategy', 'Checking if directory exists', {
                dirPath: dirPath
            });
            const stat = await fs.stat(dirPath);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }

    async ensureDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error creating directory', error, {
                dirPath: dirPath
            });
            throw error;
        }
    }

    async updateBothConnectionStatuses(connectionStatus = null, error = null) {
        try {
            if (!this.connectionRecord || !this.connectionWhatsapp) {
                structuredLogger.warn('WhatsAppWebJsStrategy', 'No connection record available for update', {
                    connectionId: this.connectionId
                });
                throw new Error('No connection record or whatsapp connection record available for update');
            }

            const recordStatus = (connectionStatus=='authenticated' || connectionStatus=='connected') ? 'active' : connectionStatus;
            await this.updateConnectionRecord({status: recordStatus});
            structuredLogger.debug('WhatsAppWebJsStrategy', 'WhatsApp connection status updated', {
                connectionId: this.connectionId,
                whatsappStatus: connectionStatus
            });

            await this.updateWhatsAppConnectionRecord({estatus: connectionStatus, lastError: error});

        } catch (updateError) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error updating connection statuses', updateError, {
                connectionId: this.connectionId,
                whatsappStatus: connectionStatus
            });
        }
    }

    mapWhatsAppStatusToConnectionStatus(whatsappStatus) {
        const statusMap = {
            'disconnected': 'inactive',
            'connecting': 'connecting', 
            'connected': 'active',
            'authenticated': 'active',
            'error': 'error'
        };
        
        return statusMap[whatsappStatus] || 'inactive';
    }    
    
    getQR() {
        return this.currentQR;
    }

    isReady() {
        return this.isLoggedIn && this.isClientReady;
    }    
}

module.exports = WhatsAppWebJsStrategy;