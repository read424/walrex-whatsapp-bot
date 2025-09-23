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

    constructor(webSocket, connectionName = 'client-walrex', tenantId = null) {
        super();
        this.webSocketAdapter = webSocket;
        this.parentConnection = null;
        this.connectionName = connectionName;
        this.clientId = connectionName;
        this.tenantId = tenantId;
        this.isLoggedIn = false;
        this.isClientReady = false;
        this.whatsAppBot = null; // Se inicializará después
        this.whatsAppAdmin = null; // Se inicializará después
        this.currentQR = null; // Para almacenar el QR actual
        this.connectionRecord = null; // Registro en la base de datos

        this.sessionBasePath = path.join(__dirname, '../../../sessions');
        this.sessionPath = path.join(this.sessionBasePath, this.connectionName);

        //properties for timeout by QR
        this.qrAttempts = 0;
        this.maxQrAttempts = 4;
        this.qrTimeout = null;
        this.qrTimeoutDuration = 30000;
        this.isConnectionClosed = false;

        // ChatService
        this.chatService = new ChatService(webSocket);

        this.messageListenerSetup = false;
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
                    dataPath: this.sessionBasePath,
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
            await this.updateBothConnectionStatuses('connecting');

            structuredLogger.info('WhatsAppWebJsStrategy', 'About to initialize client', {
                clientId: this.clientId
            });
            
            // 5. Inicializar cliente
            await this.client.initialize();
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'Client initialization completed', {
                clientId: this.clientId
            });
            
        } catch (error) {
            await this.updateBothConnectionStatuses('error', error.message);
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error during initialization', error, {
                clientId: this.clientId
            });
            throw error;
        }
    }

    async ensureConnectionRecord(){
        try {
            this.connectionRecord = await WhatsAppConnection.getConnectionByName(this.connectionName);

            if(!this.connectionRecord){
                let parentConnection = await Connection.create({
                    connection_name: this.connectionName,
                    provider_type: 'whatsapp',
                    status: 'inactive', // Estado inicial
                    tenant_id: this.tenantId,
                    // Otros campos que necesite la tabla connections
                });
                
                //crear nuevo registro
                this.connectionRecord = await WhatsAppConnection.create({
                    clientId: this.clientId,
                    tenantId: this.tenantId,
                    connectionId: parentConnection.id,
                    status: 'disconnected',
                    settings: {
                        autoReconnect: true,
                        maxConnectionAttempts: 3
                    }
                });

                structuredLogger.info('WhatsAppWebJsStrategy', 'New connection record created', {
                    clientId: this.clientId,
                    tenantId: this.tenantId,
                    connectionId: parentConnection.id,
                    whatsappConnectionId: this.connectionRecord.id
                });
            }else{
                this.parentConnection = await Connection.findByPk(this.connectionRecord.connectionId);
                if (!this.parentConnection) {
                    throw new Error(`Parent connection not found for WhatsApp connection ${this.connectionRecord.connectionId}`);
                }
                this.clientId = this.connectionRecord.connectionId;
                    
                if(!this.connectionRecord.connectionId){
                    this.connectionRecord.connectionId;
                    await this.connectionRecord.save();

                    structuredLogger.info('WhatsAppWebJsStrategy', 'Updated existing record with connectionId', {
                        clientId: this.clientId,
                        connectionId: this.connectionId
                    });
                }
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
            // Si la conexion esta cerrada, no procesar mas qr
            if(this.isConnectionClosed){
                structuredLogger.info('WhatsAppWebJsStrategy', 'Connection closed, skipping QR processing', {
                    clientId: this.clientId
                });
                return;
            }

            // Llamar el método que maneja el timeout
            await this.handleQRTimeout();
            
            // Si se cerró por timeout, no procesar el QR
            if (this.isConnectionClosed) return;


            qrcode.generate(qr, {small: true});
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'QR Code generated - Session not found', { 
                clientId: this.clientId,
                attempts: this.qrAttempts,
                maxAttempts: this.maxQrAttempts,
                qrLength: qr.length
            });
            
            try {
                const base64Q = await QRCode.toDataURL(qr, {type: 'image/png'});
                this.currentQR = base64Q;

                await this.updateWhatsAppConnectionRecord({
                    qrCode: base64Q
                });

                // Emitir QR específicamente al tenant
                this.webSocketAdapter.emitQRToTenant(this.tenantId, { 
                    qr: base64Q, 
                    clientId: this.clientId,
                    attempts: this.qrAttempts,
                    maxAttempts: this.maxQrAttempts
                });

            } catch (error) {
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error generating QR image', error);
            }
        });

        this.client.on('ready', async () => {
            console.log('WhatsApp event ready');
            this.isLoggedIn = true;
            this.isClientReady = true;
            this.currentQR = null;

            structuredLogger.info('WhatsAppWebJsStrategy', 'WhatsApp client ready event triggered', {
                clientId: this.clientId,
                isLoggedIn: this.isLoggedIn,
                isClientReady: this.isClientReady,
                messageListenerSetup: this.messageListenerSetup
            });

            // Limpiar timeout y reiniciar contadores al conectarse exitosamente
            this.resetQRAttempts();

            const deviceInfo = await this.getDeviceInfo();

            //Actualizar registro en la base de datos
            await this.updateBothConnectionStatuses('connected');

            await this.updateWhatsAppConnectionRecord({
                qrCode: null,
                deviceInfo: deviceInfo,
                phoneNumber: deviceInfo?.phoneNumber || null,
                lastSeen: new Date()
            });

            
            await this.connectionRecord.resetConnectionAttempts();

            // Session data is automatically managed by whatsapp-web.js

            structuredLogger.info('WhatsAppWebJsStrategy', 'WhatsApp client ready', {
                clientId: this.clientId,
                phoneNumber: deviceInfo?.phoneNumber || null,
            });

            if(!this.messageListenerSetup){
                this.setupMessageListeners();
                this.messageListenerSetup = true;
                structuredLogger.info('WhatsAppWebJsStrategy', 'Message listeners set up after ready event', {
                    clientId: this.clientId
                });                
            }

            if (!this.whatsAppBot) {
                const CustomerService = require('../outbound/customerService');
                this.whatsAppBot = new WhatsAppBotRefactored(new CustomerService());
                this.whatsAppBot.setWhatsAppClient(this);
                structuredLogger.info('WhatsAppWebJsStrategy', 'WhatsAppBot initialized after ready', {
                    clientId: this.clientId
                });                
            }

            // Asegurar que los listeners de mensajes estén configurados
            this.listenMessages();

            // Setup message status listeners
            this.setupMessageStatusListeners();

            this.webSocketAdapter.emitToTenant(this.tenantId, 'whatsappReady', {
                clientId: this.clientId,
                tenantId: this.tenantId,
                phoneNumber: deviceInfo?.phoneNumber || null,
                timestamp: new Date().toISOString()
            });
        });

        this.client.on('authenticated', async (session) => {
            console.log('WhatsApp event authenticated');
            this.isLoggedIn = true;
            this.isClientReady = true;
            this.resetQRAttempts();
            
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'WhatsApp client authenticated event triggered', {
                clientId: this.clientId,
                isLoggedIn: this.isLoggedIn,
                isClientReady: this.isClientReady,
                messageListenerSetup: this.messageListenerSetup
            });
            
            await this.updateBothConnectionStatuses('authenticated');
            
            structuredLogger.info('WhatsAppWebJsStrategy', 'Session authenticated successfully', {
                clientId: this.clientId,
            });

            // Session data is automatically managed by whatsapp-web.js

            // Configurar listeners de mensajes también en authenticated (por si ready no se dispara)
            if(!this.messageListenerSetup){
                this.setupMessageListeners();
                this.messageListenerSetup = true;
                structuredLogger.info('WhatsAppWebJsStrategy', 'Message listeners set up after authenticated event', {
                    clientId: this.clientId
                });                
            }
            

            this.webSocketAdapter.emitToTenant(this.tenantId, 'authenticated', {
                clientId: this.clientId,
                tenantId: this.tenantId,
                timestamp: new Date().toISOString()
            });
        });

        this.client.on('auth_failure', async (msg) => {
            console.log('WhatsApp event auth_failure');
            await this.updateBothConnectionStatuses('error', msg);

            structuredLogger.error('WhatsAppWebJsStrategy', 'Authentication failed', null, { 
                clientId: this.clientId,
                message: msg 
            });

            await this.clearSession();
        });

        this.client.on('disconnected', async (reason) => {
            console.log('WhatsApp event disconnected');
            this.isLoggedIn = false;
            this.isClientReady = false;
            this.messageListenerSetup = false;

            await this.updateBothConnectionStatuses('disconnected', reason);

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

    }

    setupMessageListeners(){
        structuredLogger.info('WhatsAppWebJsStrategy', 'Setting up message listeners', {
            clientId: this.clientId,
            isClientReady: this.isClientReady,
            hasClient: !!this.client,
            messageListenerSetup: this.messageListenerSetup
        });

        if (!this.client || !this.isClientReady) {
            structuredLogger.warn('WhatsAppWebJsStrategy', 'Cannot setup message listeners - client not ready', {
                clientId: this.clientId,
                hasClient: !!this.client,
                isClientReady: this.isClientReady
            });
            return;
        }
        
        structuredLogger.info('WhatsAppWebJsStrategy', 'Registering message event listener', {
            clientId: this.clientId,
            clientEvents: this.client.listenerCount('message')
        });
        
        this.client.on('message', async (message) => {
            structuredLogger.info('WhatsAppWebJsStrategy', 'Raw message received', {
                messageFrom: message.from,
                messageBody: message.body,
                messageType: message.type,
                timestamp: new Date().toISOString(),
                clientId: this.clientId
            });

            try {
                // Filtrar mensajes no deseados
                if (message.from === PHONE_PATTERNS.STATUS_BROADCAST || 
                    message.from.endsWith(PHONE_PATTERNS.GROUP_CHAT_SUFFIX) || 
                    (!message.from.includes('51913061289@c.us') && !message.from.includes('51935926562@c.us'))) {
                    structuredLogger.debug('WhatsAppWebJsStrategy', 'Message filtered out', {
                        messageFrom: message.from,
                        reason: 'filtered',
                        clientId: this.clientId
                    });
                    return;
                }
                
                structuredLogger.info('WhatsAppWebJsStrategy', 'Processing incoming message', {
                    messageFrom: message.from,
                    messageBody: message.body?.substring(0, 50) + '...',
                    clientId: this.clientId
                });
                
                // Delegar la lógica al método `handleIncomingMessage`
                await this.handleIncomingMessage(message);
            } catch (error) {
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error in message listener', error, {
                    messageFrom: message.from,
                    clientId: this.clientId
                });
            }
        });

        structuredLogger.info('WhatsAppWebJsStrategy', 'Message listener successfully attached', {
            clientId: this.clientId,
            totalMessageListeners: this.client.listenerCount('message')
        });        
    }

    // Método para verificar el estado de los listeners (debug)
    getListenerStatus() {
        return {
            clientId: this.clientId,
            hasClient: !!this.client,
            isClientReady: this.isClientReady,
            messageListenerSetup: this.messageListenerSetup,
            totalMessageListeners: this.client ? this.client.listenerCount('message') : 0,
            isLoggedIn: this.isLoggedIn
        };
    }

    async listenMessages() {
        structuredLogger.info('WhatsAppWebJsStrategy', 'listenMessages called', {
            clientId: this.clientId,
            isClientReady: this.isClientReady,
            messageListenerSetup: this.messageListenerSetup
        });


        if (!this.isClientReady) {
            structuredLogger.warn('WhatsAppWebJsStrategy', 'listenMessages called but client not ready yet', {
                    clientId: this.clientId
                });
            return;
        }

        if (this.messageListenerSetup) {
            structuredLogger.info('WhatsAppWebJsStrategy', 'Message listeners already set up', {
                clientId: this.clientId
            });
            return;
        }

        this.setupMessageListeners();
        this.messageListenerSetup = true;
        structuredLogger.info('WhatsAppWebJsStrategy', 'Message listeners set up via listenMessages method', {
            clientId: this.clientId
        });
    }

    async handleIncomingMessage(message) {
        structuredLogger.info('WhatsAppWebJsStrategy', `handleIncomingMessage called`, {
            messageFrom: message.from,
            messageBody: message.body,
            hasWhatsAppBot: !!this.whatsAppBot,
                clientId: this.clientId
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
                    clientId: this.clientId
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

                await this.chatService.updateChatSessionStatus(message.id.__serialized, status);

                structuredLogger.debug('WhatsAppWebJsStrategy', 'Message status updated', {
                    messageId: message.id._serialized,
                    status
                });
            }catch(error){
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error updating message status', error, {
                clientId: this.clientId
            });            
        }
        });
    }

    async updateWhatsAppConnectionRecord(data) {
        if (this.connectionRecord) {
            try {
                // Update specific fields in the WhatsAppConnection model
                Object.assign(this.connectionRecord, data);
                await this.connectionRecord.save();
                
                structuredLogger.debug('WhatsAppWebJsStrategy', 'WhatsApp connection record updated', {
                    clientId: this.clientId,
                    updates: Object.keys(data)
                });
            } catch (error) {
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error updating WhatsApp connection record', error, {
                    clientId: this.clientId,
                    data: data
                });
                throw error;
            }
        } else {
            structuredLogger.warn('WhatsAppWebJsStrategy', 'No connection record available for update', {
                clientId: this.clientId
            });
        }
    }
    
    async updateConnectionRecord(data){
        structuredLogger.warn('WhatsAppWebJsStrategy', 'updateConnectionRecord is deprecated, use updateWhatsAppConnectionRecord', {
            clientId: this.clientId
        });
        return await this.updateWhatsAppConnectionRecord(data);
    }

    async updateConnectionStatus(status, error = null){
        if (this.connectionRecord) {
            try {
            await this.connectionRecord.updateStatus(status, error);
            structuredLogger.info('WhatsAppWebJsStrategy', 'Connection status updated', {
                clientId: this.clientId,
                status: status,
                error: error
            });
            } catch (updateError) {
                structuredLogger.error('WhatsAppWebJsStrategy', 'Error updating connection status', updateError, {
                    clientId: this.clientId,
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
            const authSessionDir = path.join(this.sessionBasePath, `session-${this.clientId}`);
            
            if (await this.directoryExists(authSessionDir)) {
                await fs.rmdir(authSessionDir, { recursive: true });
                structuredLogger.info('WhatsAppWebJsStrategy', 'LocalAuth session directory cleared', {
                    clientId: this.clientId,
                    sessionDir: authSessionDir
                });
            }

            await this.updateWhatsAppConnectionRecord({
                qrCode: null,
                phoneNumber: null,
                deviceInfo: null
            });

            // Session backup variables removed - using filesystem only

            structuredLogger.info('WhatsAppWebJsStrategy', 'Session data cleared completely', {
                clientId: this.clientId
            });
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error clearing session', error, {
                clientId: this.clientId
            });
        }
    }

    // captureAndSaveSessionData eliminado - whatsapp-web.js maneja sesiones automáticamente

    async restoreSessionIfExists(){
        // WhatsApp-web.js maneja automáticamente la restauración de sesiones desde el filesystem
        // Este método es llamado por WhatsAppConnectionManager durante la inicialización
        try {
            await this.ensureSessionDirectory();
            
            const sessionExists = await this.directoryExists(this.sessionPath);
            
            if (sessionExists) {
                structuredLogger.info('WhatsAppWebJsStrategy', 'Session directory exists, whatsapp-web.js will restore automatically', {
                    clientId: this.clientId,
                    sessionPath: this.sessionPath
                });
                
                // Verificar si hay archivos de sesión válidos
                const sessionFiles = await fs.readdir(this.sessionPath).catch(() => []);
                if (sessionFiles.length > 0) {
                    structuredLogger.info('WhatsAppWebJsStrategy', 'Session files found, restoration should work', {
                clientId: this.clientId,
                        fileCount: sessionFiles.length
                    });
                } else {
                    structuredLogger.warn('WhatsAppWebJsStrategy', 'Session directory exists but no files found', {
                clientId: this.clientId,
                        sessionPath: this.sessionPath
                    });
                }
            } else {
                structuredLogger.info('WhatsAppWebJsStrategy', 'No existing session found, will require QR scan', {
                    clientId: this.clientId,
                    sessionPath: this.sessionPath
                });
            }
            
            // Siempre retornamos true para que WhatsAppConnectionManager continúe con la inicialización
            // WhatsApp-web.js se encargará de determinar si puede restaurar la sesión o necesita QR
            return true;
            
        } catch (error) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error checking session directory', error, {
                clientId: this.clientId
            });
            // Retornamos true para que no bloquee la inicialización
            return true;
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
            clientId: this.clientId,
            isLoggedIn: this.isLoggedIn,
            isClientReady: this.isClientReady,
            messageListenerSetup: this.messageListenerSetup,
            hasClient: !!this.client,
            hasWhatsAppBot: !!this.whatsAppBot,
            isConnectionClosed: this.isConnectionClosed,
            whatsappConnectionId: this.connectionRecord?.id || null,
            whatsappStatus: this.connectionRecord?.status || 'unknown',
            parentConnectionId: this.parentConnection?.id || null,
            parentStatus: this.parentConnection?.status || 'unknown' // AGREGAR
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
            clientId: this.clientId
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
            clientId: this.clientId,
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

            await this.updateBothConnectionStatuses('disconnected', 'QR timeout occurred');

            if(this.client){
                await this.client.destroy();
                this.client = null;
            }

            this.isLoggedIn = false;
            this.currentQR = null;

            //Emitir evento de timeout al frontend
            this.webSocketAdapter.emitToTenant(this.tenantId, 'qrTimeout', {
                clientId: this.clientId,
                tenantId: this.tenantId,
                attempts: this.qrAttempts,
                maxAttempts: this.maxQrAttempts,
                message: 'Se alcanzo el maximo de intentos para escanear el QR',
                timestamp: new Date().toISOString()
            });

            structuredLogger.info('WhatsAppWebJsStrategy', 'Connection closed due to QR timeout', {
                clientId: this.clientId,
                attempts: this.qrAttempts
            });

        }catch(error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error closing connection due to QR timeout', error, {
                clientId: this.clientId,
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
            clientId: this.clientId
        });
    }

    async restartConnection(){
        try {

            structuredLogger.info('WhatsAppWebJsStrategy', 'Restarting connection manually', {
                clientId: this.clientId
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
                clientId: this.clientId
            });
        }catch(error){
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error restarting connection', error, {
                clientId: this.clientId
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

    // Métodos de backup eliminados - whatsapp-web.js maneja las sesiones automáticamente

    async directoryExists(dirPath) {
        try {
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

    async updateBothConnectionStatuses(whatsappStatus, connectionStatus = null, error = null) {
        try {
            // Determinar el status de la tabla connections basado en whatsapp status
            const parentStatus = connectionStatus || this.mapWhatsAppStatusToConnectionStatus(whatsappStatus);

            // Actualizar WhatsAppConnection
            if (this.connectionRecord) {
                await this.connectionRecord.updateStatus(whatsappStatus, error);
                structuredLogger.debug('WhatsAppWebJsStrategy', 'WhatsApp connection status updated', {
            clientId: this.clientId,
                    whatsappStatus: whatsappStatus
                });
            }

            // Actualizar Connection padre
            if (this.parentConnection) {
                this.parentConnection.status = parentStatus;
                this.parentConnection.lastSeen = new Date();
                if (error) {
                    this.parentConnection.lastError = error;
                }
                await this.parentConnection.save();
                
                structuredLogger.debug('WhatsAppWebJsStrategy', 'Parent connection status updated', {
                    clientId: this.clientId,
                    parentStatus: parentStatus
                });
            }

            structuredLogger.info('WhatsAppWebJsStrategy', 'Both connection statuses updated', {
                clientId: this.clientId,
                whatsappStatus: whatsappStatus,
                parentStatus: parentStatus,
                error: error
            });

        } catch (updateError) {
            structuredLogger.error('WhatsAppWebJsStrategy', 'Error updating connection statuses', updateError, {
                clientId: this.clientId,
                whatsappStatus: whatsappStatus
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