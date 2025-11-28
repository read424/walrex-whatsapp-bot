/**
 * WhatsAppWebJsStrategy - Implementación de WhatsAppConnectionPort
 *
 * Responsabilidades:
 * - Implementar la interfaz WhatsAppConnectionPort usando whatsapp-web.js
 * - Gestionar el ciclo de vida del cliente WhatsApp
 * - Coordinar con EventHandler y MessageHandler
 * - Gestión de sesiones LocalAuth
 *
 * Esta clase IMPLEMENTA el patrón Strategy para conexiones WhatsApp.
 * En el futuro se pueden crear otras estrategias (Baileys, API Oficial, etc.)
 * que implementen la misma interfaz WhatsAppConnectionPort.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const WhatsAppConnectionPort = require('../../../application/ports/output/WhatsAppConnectionPort');
const path = require('path');
const fs = require('fs').promises;

class WhatsAppWebJsStrategy extends WhatsAppConnectionPort {
    /**
     * Constructor con inyección de dependencias
     * @param {Object} dependencies - Dependencias
     * @param {Object} dependencies.connectionRepository - Repositorio de conexiones
     * @param {Object} dependencies.whatsappConnectionRepository - Repositorio WhatsApp específico
     * @param {Object} dependencies.eventHandler - Manejador de eventos
     * @param {Object} dependencies.messageHandler - Manejador de mensajes
     * @param {Object} dependencies.chatService - Servicio de chat
     * @param {Object} dependencies.webSocketAdapter - Adaptador WebSocket
     * @param {Object} dependencies.logger - Logger
     * @param {string} dependencies.connectionId - ID de conexión
     * @param {string} dependencies.tenantId - ID del tenant
     */
    constructor({
        connectionRepository,
        whatsappConnectionRepository,
        eventHandler,
        messageHandler,
        chatService,
        webSocketAdapter,
        logger,
        connectionId,
        tenantId
    }) {
        super();

        // Validar dependencias requeridas
        if (!connectionRepository || !whatsappConnectionRepository || !eventHandler ||
            !messageHandler || !chatService || !webSocketAdapter || !logger) {
            throw new Error('All dependencies are required for WhatsAppWebJsStrategy');
        }

        this.connectionRepository = connectionRepository;
        this.whatsappConnectionRepository = whatsappConnectionRepository;
        this.eventHandler = eventHandler;
        this.messageHandler = messageHandler;
        this.chatService = chatService;
        this.webSocketAdapter = webSocketAdapter;
        this.logger = logger;
        this.connectionId = connectionId;
        this.tenantId = tenantId;

        // Estado del cliente
        this.client = null;
        this.isLoggedIn = false;
        this.isClientReady = false;
        this.messageListenerSetup = false;
        this.isConnectionClosed = false;
        this.currentQR = null;

        // Promise para esperar el QR
        this.qrPromise = null;
        this.qrPromiseResolve = null;

        // Configuración de sesión
        this.sessionBasePath = null;
        this.connectionName = null;

        // Referencias a registros de BD
        this.connectionRecord = null;
        this.connectionWhatsapp = null;

        // Contadores QR
        this.qrAttempts = 0;
        this.maxQrAttempts = 3;  // Consistente con EventHandler
        this.qrTimeout = null;
        this.qrTimeoutDuration = 30000;

        this.logger.info('WhatsAppWebJsStrategy', 'Strategy initialized', {
            connectionId,
            tenantId
        });
    }

    /**
     * Inicializa el cliente de WhatsApp
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Resetear contador de intentos de QR al inicializar (importante después de timeout)
            this.resetQRAttempts();

            this.configureSessionBasePath();

            this.logger.info('WhatsAppWebJsStrategy', 'Initializing WhatsApp client', {
                tenantId: this.tenantId,
                dataPath: this.sessionBasePath
            });

            // Buscar o crear registro en la base de datos
            await this.ensureConnectionRecord();

            const ignoreRestoreSession = process.env.IGNORE_RESTORE_SESSION === 'true';
            const authConfig = ignoreRestoreSession
                ? {}
                : { clientId: this.connectionName };

            this.logger.info('WhatsAppWebJsStrategy', 'LocalAuth configuration', {
                connectionId: this.connectionId,
                ignoreRestoreSession,
                authConfig
            });

            // Crear cliente de WhatsApp con configuración mejorada para estabilidad
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
                        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        '--disable-gpu',
                        '--disable-software-rasterizer',
                        '--disable-extensions',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gl-drawing-for-tests',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-ipc-flooding-protection'
                    ],
                    timeout: 120000,
                    handleSIGINT: false,
                    handleSIGTERM: false,
                    handleSIGHUP: false
                }
            });

            // Configurar event listeners usando el EventHandler
            this.setupEventListeners();

            // Agregar listener para errores no manejados del cliente
            this.client.on('error', (error) => {
                this.logger.error('WhatsAppWebJsStrategy', 'WhatsApp client error', error, {
                    connectionId: this.connectionId
                });
            });

            // Inicializar cliente con manejo de errores mejorado
            try {
                await this.client.initialize();

                this.logger.info('WhatsAppWebJsStrategy', 'WhatsApp client initialization started', {
                    connectionId: this.connectionId
                });
            } catch (initError) {
                this.logger.error('WhatsAppWebJsStrategy', 'Error during client.initialize()', initError, {
                    connectionId: this.connectionId,
                    errorName: initError.name,
                    errorMessage: initError.message
                });

                // Intentar limpiar recursos si la inicialización falla
                try {
                    if (this.client) {
                        await this.client.destroy();
                        this.client = null;
                    }
                } catch (cleanupError) {
                    this.logger.error('WhatsAppWebJsStrategy', 'Error cleaning up after failed initialization', cleanupError);
                }

                throw initError;
            }

        } catch (error) {
            this.logger.error('WhatsAppWebJsStrategy', 'Error initializing WhatsApp client', error, {
                connectionId: this.connectionId
            });
            throw error;
        }
    }

    /**
     * Configura la ruta base de sesiones
     */
    configureSessionBasePath() {
        const changeDirectorySession = process.env.CHANGE_DIRECTORY_SESSION === 'true';
        this.logger.info('WhatsAppWebJsStrategy', 'Define Session Path', {
            sessionBasePath: this.sessionBasePath,
            isChangeDirectory: changeDirectorySession
        });

        if (!this.sessionBasePath && changeDirectorySession) {
            this.sessionBasePath = path.join(__dirname, '../../../sessions');
        }
    }

    /**
     * Configura los event listeners delegando al EventHandler
     */
    setupEventListeners() {
        const context = {
            connectionId: this.connectionId,
            tenantId: this.tenantId,
            isConnectionClosed: () => this.isConnectionClosed,
            getDeviceInfo: () => this.getDeviceInfo(),
            resetQRAttempts: () => this.resetQRAttempts(),
            handleQRTimeout: () => this.handleQRTimeout(),
            clearSession: () => this.clearSession(),
            notifyQRAvailable: (qr) => this.notifyQRAvailable(qr),
            whatsappConnection: this.connectionWhatsapp,
            connectionRecord: this.connectionRecord,
            isClientReady: () => this.isClientReady,
            isLoggedIn: () => this.isLoggedIn
        };

        this.eventHandler.setupEventListeners(this.client, context);
    }

    /**
     * Configura los message listeners delegando al MessageHandler
     */
    setupMessageListeners() {
        const context = {
            connectionId: this.connectionId,
            tenantId: this.tenantId,
            connectionRecord: this.connectionRecord,
            isClientReady: () => this.isClientReady,
            isLoggedIn: () => this.isLoggedIn
        };

        this.messageHandler.setupMessageListeners(this.client, context);
        this.messageListenerSetup = true;

        this.logger.info('WhatsAppWebJsStrategy', 'Message listeners setup completed', {
            connectionId: this.connectionId
        });
    }

    /**
     * Configura los listeners de estado de mensaje
     */
    setupMessageStatusListeners() {
        const context = {
            connectionId: this.connectionId,
            isClientReady: () => this.isClientReady
        };

        this.messageHandler.setupMessageStatusListeners(this.client, context);
    }

    /**
     * Asegura que exista un registro de conexión en BD
     */
    async ensureConnectionRecord() {
        try {
            const { Connection, WhatsAppConnection, ChannelConnection } = require('../../../models');

            // Primero intentar buscar en la nueva tabla channel_connections
            const channelConnection = await ChannelConnection.findByPk(this.connectionId);

            if (channelConnection) {
                this.logger.info('WhatsAppWebJsStrategy', 'Found connection in channel_connections', {
                    connectionId: this.connectionId,
                    connectionName: channelConnection.connection_name
                });

                this.connectionName = channelConnection.connection_name;

                // Buscar o crear registro en tabla legacy Connection
                let [connectionRecord] = await Connection.findOrCreate({
                    where: { id: this.connectionId },
                    defaults: {
                        id: this.connectionId,
                        name: channelConnection.connection_name,
                        tenant_id: this.tenantId,
                        status: 'inactive',
                        is_active: true
                    }
                });

                this.connectionRecord = connectionRecord;

                // Buscar o crear registro de WhatsAppConnection
                let [whatsappConnection] = await WhatsAppConnection.findOrCreate({
                    where: { connection_id: this.connectionId },
                    defaults: {
                        connection_id: this.connectionId,
                        status: 'connecting',
                        qr_code: null,
                        phone_number: null,
                        device_info: null,
                        last_seen: new Date()
                    }
                });

                this.connectionWhatsapp = whatsappConnection;

                this.logger.info('WhatsAppWebJsStrategy', 'Connection records synchronized', {
                    connectionId: this.connectionId,
                    connectionName: this.connectionName,
                    whatsappConnectionId: whatsappConnection.id
                });

            } else {
                // Fallback: buscar en tabla legacy Connection
                this.connectionRecord = await Connection.findByPk(this.connectionId);

                if (!this.connectionRecord) {
                    throw new Error(`Connection record not found for ID: ${this.connectionId}`);
                }

                this.connectionName = this.connectionRecord.name || `connection_${this.connectionId}`;

                // Buscar o crear registro de WhatsAppConnection
                let [whatsappConnection] = await WhatsAppConnection.findOrCreate({
                    where: { connection_id: this.connectionId },
                    defaults: {
                        connection_id: this.connectionId,
                        status: 'connecting',
                        qr_code: null,
                        phone_number: null,
                        device_info: null,
                        last_seen: new Date()
                    }
                });

                this.connectionWhatsapp = whatsappConnection;

                this.logger.info('WhatsAppWebJsStrategy', 'Connection record ensured (legacy)', {
                    connectionId: this.connectionId,
                    connectionName: this.connectionName,
                    whatsappConnectionId: whatsappConnection.id
                });
            }

        } catch (error) {
            this.logger.error('WhatsAppWebJsStrategy', 'Error ensuring connection record', error, {
                connectionId: this.connectionId
            });
            throw error;
        }
    }

    /**
     * Obtiene información del dispositivo conectado
     * @returns {Promise<Object|null>}
     */
    async getDeviceInfo() {
        try {
            if (!this.client) return null;

            const info = await this.client.info;

            this.logger.info('WhatsAppWebJsStrategy', 'Device info retrieved', info);

            return {
                phoneNumber: info?.wid?.user || null,
                platform: info?.platform || 'unknown',
                deviceModel: info?.phone?.device_model || 'unknown',
                osVersion: info?.phone?.os_version || 'unknown',
                waVersion: info?.phone?.wa_version || 'unknown',
                battery: info?.battery || null,
                connected: info?.connected || false
            };
        } catch (error) {
            this.logger.error('WhatsAppWebJsStrategy', 'Error getting device info', error);
            return null;
        }
    }

    /**
     * Envía un mensaje de texto
     * @param {string} number - Número de teléfono
     * @param {string} message - Mensaje a enviar
     * @returns {Promise<void>}
     */
    async sendMessage(number, message) {
        try {
            this.logger.info('WhatsAppWebJsStrategy', `Sending message to: ${number}`, {
                messageLength: message?.length || 0,
                messagePreview: message?.substring(0, 50) + '...'
            });

            // Validar formato del número
            if (!number.includes('@c.us')) {
                number = number + '@c.us';
            }

            await this.client.sendMessage(number, message);

            this.logger.info('WhatsAppWebJsStrategy', `Message sent successfully to: ${number}`);
        } catch (error) {
            this.logger.error('WhatsAppWebJsStrategy', `Error sending message to ${number}`, error, {
                messageLength: message?.length || 0
            });
            throw error;
        }
    }

    /**
     * Envía un mensaje con media
     * @param {string} number - Número de teléfono
     * @param {Object} media - Objeto de media
     * @returns {Promise<void>}
     */
    async sendMessageMedia(number, media) {
        try {
            this.logger.info('WhatsAppWebJsStrategy', `Sending media message to: ${number}`, {
                mediaType: media?.mimetype || 'unknown',
                mediaSize: media?.data?.length || 0
            });

            if (!number || typeof number !== 'string') {
                throw new Error('Invalid phone number format');
            }

            const normalizedNumber = number.includes('@c.us') ? number : `${number}@c.us`;

            if (!this.client) {
                throw new Error('WhatsApp client not initialized');
            }

            if (!this.isLoggedIn) {
                throw new Error('WhatsApp client not authenticated');
            }

            if (!media || !media.mimetype || !media.data) {
                throw new Error('Invalid media object provided');
            }

            await this.client.sendMessage(normalizedNumber, media);

            this.logger.info('WhatsAppWebJsStrategy', `Media message sent successfully to: ${number}`);

        } catch (error) {
            this.logger.error('WhatsAppWebJsStrategy', `Error sending media message to ${number}`, error);
            throw error;
        }
    }

    /**
     * Envía botones (no soportado en versiones recientes de whatsapp-web.js)
     * @param {string} number - Número de teléfono
     * @param {string} message - Mensaje
     * @param {Array} buttons - Botones
     * @param {string} footer - Footer
     * @returns {Promise<void>}
     */
    async sendButtons(number, message, buttons, footer) {
        this.logger.warn('WhatsAppWebJsStrategy', 'sendButtons is deprecated in recent whatsapp-web.js versions');
        // Enviar mensaje de texto en su lugar
        await this.sendMessage(number, message + '\n' + footer);
    }

    /**
     * Obtiene el código QR actual
     * @returns {string|null}
     */
    getQRCode() {
        return this.currentQR;
    }

    /**
     * Espera a que el QR esté disponible
     * @returns {Promise<string|null>} - Promesa que se resuelve con el QR base64
     */
    async waitForQR() {
        // Si ya hay un QR disponible, devolverlo inmediatamente
        if (this.currentQR) {
            this.logger.info('WhatsAppWebJsStrategy', 'QR already available', {
                connectionId: this.connectionId
            });
            return this.currentQR;
        }

        // Si ya está autenticado, no habrá QR
        if (this.isLoggedIn || this.isClientReady) {
            this.logger.info('WhatsAppWebJsStrategy', 'Client already authenticated, no QR needed', {
                connectionId: this.connectionId,
                isLoggedIn: this.isLoggedIn,
                isClientReady: this.isClientReady
            });
            return null;
        }

        // Crear una promesa que se resolverá cuando el QR esté disponible
        // Esta promesa esperará indefinidamente hasta que whatsapp-web.js genere el QR
        if (!this.qrPromise) {
            this.qrPromise = new Promise((resolve) => {
                this.qrPromiseResolve = resolve;
            });
        }

        this.logger.info('WhatsAppWebJsStrategy', 'Waiting for QR code from whatsapp-web.js', {
            connectionId: this.connectionId
        });

        // Esperar indefinidamente hasta que la librería genere el QR
        const qr = await this.qrPromise;

        this.logger.info('WhatsAppWebJsStrategy', 'QR received from whatsapp-web.js', {
            connectionId: this.connectionId,
            hasQR: !!qr
        });

        return qr;
    }

    /**
     * Notifica que el QR está disponible
     * @param {string} qr - Código QR en base64
     */
    notifyQRAvailable(qr) {
        this.currentQR = qr;

        if (this.qrPromiseResolve) {
            this.logger.info('WhatsAppWebJsStrategy', 'Resolving QR promise', {
                connectionId: this.connectionId
            });
            this.qrPromiseResolve(qr);
            this.qrPromiseResolve = null;
            this.qrPromise = null;
        }
    }

    /**
     * Verifica si el cliente está listo
     * @returns {boolean}
     */
    isReady() {
        return this.client && this.isLoggedIn && this.isClientReady;
    }

    /**
     * Obtiene el estado de la conexión
     * @returns {Object}
     */
    getConnectionState() {
        return {
            clientId: this.connectionId,
            isLoggedIn: this.isLoggedIn,
            isClientReady: this.isClientReady,
            messageListenerSetup: this.messageListenerSetup,
            hasClient: !!this.client,
            isConnectionClosed: this.isConnectionClosed,
            whatsappConnectionId: this.connectionRecord?.id || null,
            whatsappStatus: this.connectionRecord?.status || 'unknown'
        };
    }

    /**
     * Reinicia la conexión
     * @returns {Promise<void>}
     */
    async restartConnection() {
        try {
            this.logger.info('WhatsAppWebJsStrategy', 'Restarting connection manually', {
                connectionId: this.connectionId
            });

            this.resetQRAttempts();

            if (this.client) {
                await this.client.destroy();
                this.client = null;
            }

            this.isLoggedIn = false;
            this.isClientReady = false;
            this.messageListenerSetup = false;
            this.currentQR = null;

            await this.init();

            this.logger.info('WhatsAppWebJsStrategy', 'Connection restarted completed', {
                connectionId: this.connectionId
            });
        } catch (error) {
            this.logger.error('WhatsAppWebJsStrategy', 'Error restarting connection', error, {
                connectionId: this.connectionId
            });
            throw error;
        }
    }

    /**
     * Desconecta el cliente de WhatsApp de forma limpia
     * @returns {Promise<void>}
     */
    async disconnect() {
        try {
            this.logger.info('WhatsAppWebJsStrategy', 'Disconnecting WhatsApp client', {
                connectionId: this.connectionId,
                isLoggedIn: this.isLoggedIn,
                isClientReady: this.isClientReady
            });

            // Actualizar estado en la base de datos
            if (this.connectionRecord) {
                await this.connectionRepository.updateStatus(this.connectionId, 'disconnected');
            }

            if (this.connectionWhatsapp) {
                await this.whatsappConnectionRepository.update(this.connectionId, {
                    status: 'disconnected',
                    lastSeen: new Date()
                });
            }

            // Limpiar timeouts
            if (this.qrTimeout) {
                clearTimeout(this.qrTimeout);
                this.qrTimeout = null;
            }

            // Destruir el cliente si existe
            if (this.client) {
                try {
                    await this.client.destroy();
                } catch (destroyError) {
                    this.logger.error('WhatsAppWebJsStrategy', 'Error destroying client during disconnect', destroyError, {
                        connectionId: this.connectionId
                    });
                }
                this.client = null;
            }

            // Resetear estados
            this.isLoggedIn = false;
            this.isClientReady = false;
            this.isConnectionClosed = true;
            this.messageListenerSetup = false;
            this.currentQR = null;

            this.logger.info('WhatsAppWebJsStrategy', 'WhatsApp client disconnected successfully', {
                connectionId: this.connectionId
            });

        } catch (error) {
            this.logger.error('WhatsAppWebJsStrategy', 'Error during disconnect', error, {
                connectionId: this.connectionId
            });
            throw error;
        }
    }

    /**
     * Cierra sesión
     * @returns {Promise<void>}
     */
    async logout() {
        if (this.client) {
            await this.client.logout();
        }
    }

    /**
     * Limpia recursos
     * @returns {Promise<void>}
     */
    async cleanup() {
        if (this.qrTimeout) {
            clearTimeout(this.qrTimeout);
            this.qrTimeout = null;
        }

        if (this.client) {
            try {
                await this.client.destroy();
            } catch (error) {
                this.logger.error('WhatsAppWebJsStrategy', 'Error destroying client during cleanup', error, {
                    connectionId: this.connectionId
                });
            }
            this.client = null;
        }

        this.isLoggedIn = false;
        this.isClientReady = false;
        this.messageListenerSetup = false;
    }

    /**
     * Limpia la sesión almacenada
     * @returns {Promise<void>}
     */
    async clearSession() {
        try {
            await this.whatsappConnectionRepository.update(this.connectionId, {
                qrCode: null,
                phoneNumber: null,
                deviceInfo: null,
                status: 'disconnected'
            });

            await this.connectionRepository.updateStatus(this.connectionId, 'inactive');

            if (!this.connectionName) return;

            const authSessionDir = path.join(this.sessionBasePath, `session-${this.connectionName}`);

            if (await this.directoryExists(authSessionDir)) {
                await fs.rmdir(authSessionDir, { recursive: true });
                this.logger.info('WhatsAppWebJsStrategy', 'LocalAuth session directory cleared', {
                    connectionId: this.connectionId,
                    sessionDir: authSessionDir
                });
            }

            this.logger.info('WhatsAppWebJsStrategy', 'Session data cleared completely', {
                connectionId: this.connectionId
            });
        } catch (error) {
            this.logger.error('WhatsAppWebJsStrategy', 'Error clearing session', error, {
                connectionId: this.connectionId
            });
        }
    }

    /**
     * Maneja el timeout de QR
     * @returns {Promise<void>}
     */
    async handleQRTimeout() {
        // Obtener el contador actual del EventHandler (que es el source of truth)
        const eventHandlerAttempts = this.eventHandler.getQRAttempts();

        this.logger.info('WhatsAppWebJsStrategy', 'QR timeout check', {
            connectionId: this.connectionId,
            eventHandlerAttempts,
            strategyAttempts: this.qrAttempts,
            maxAttempts: this.maxQrAttempts,
            nextAttempt: eventHandlerAttempts + 1
        });

        // Verificar si el PRÓXIMO intento del EventHandler superaría el máximo
        // Nota: El EventHandler incrementará después de este método
        if (eventHandlerAttempts + 1 > this.maxQrAttempts) {
            this.logger.warn('WhatsAppWebJsStrategy', 'Maximum QR attempts will be exceeded', {
                connectionId: this.connectionId,
                currentAttempts: eventHandlerAttempts,
                maxAttempts: this.maxQrAttempts
            });

            // Sincronizar el contador local antes de cerrar
            this.qrAttempts = eventHandlerAttempts + 1;

            await this.closeConnectionDueToQRTimeout();
        }
    }

    /**
     * Cierra la conexión debido a timeout de QR
     * @returns {Promise<void>}
     */
    async closeConnectionDueToQRTimeout() {
        try {
            this.isConnectionClosed = true;

            this.logger.warn('WhatsAppWebJsStrategy', 'Closing connection due to QR timeout', {
                connectionId: this.connectionId,
                attempts: this.qrAttempts,
                maxAttempts: this.maxQrAttempts
            });

            // Limpiar QR almacenado en la base de datos (tabla antigua)
            await this.whatsappConnectionRepository.update(this.connectionId, {
                status: 'disconnected',
                lastError: 'QR timeout occurred',
                qrCode: null  // Limpiar QR antiguo
            });

            // Limpiar QR en channel_connections (nueva tabla v2)
            try {
                const ChannelConnectionRepositoryImpl = require('../../../infrastructure/adapters/outbound/persistence/ChannelConnectionRepositoryImpl');
                const channelConnectionRepo = new ChannelConnectionRepositoryImpl({ logger: this.logger });

                await channelConnectionRepo.updateMetadata(this.connectionId, {
                    qrCode: null,
                    qrCodeText: null,
                    qrGeneratedAt: null,
                    qrAttempts: this.qrAttempts,
                    lastError: 'QR timeout occurred'
                });

                this.logger.debug('WhatsAppWebJsStrategy', 'QR cleared in channel_connections after timeout', {
                    connectionId: this.connectionId
                });
            } catch (error) {
                this.logger.debug('WhatsAppWebJsStrategy', 'Could not clear QR in channel_connections', {
                    connectionId: this.connectionId,
                    error: error.message
                });
            }

            // Destruir el cliente de WhatsApp completamente
            if (this.client) {
                try {
                    this.logger.info('WhatsAppWebJsStrategy', 'Destroying WhatsApp client', {
                        connectionId: this.connectionId
                    });

                    await this.client.destroy();
                    this.client = null;

                    this.logger.info('WhatsAppWebJsStrategy', 'WhatsApp client destroyed successfully', {
                        connectionId: this.connectionId
                    });
                } catch (destroyError) {
                    this.logger.error('WhatsAppWebJsStrategy', 'Error destroying client', destroyError, {
                        connectionId: this.connectionId
                    });
                }
            }

            this.isLoggedIn = false;
            this.isClientReady = false;
            this.currentQR = null;

            // Emitir evento de timeout al frontend
            this.webSocketAdapter.emitToTenant(this.tenantId, 'qrTimeout', {
                clientId: this.connectionId,
                tenantId: this.tenantId,
                attempts: this.qrAttempts,
                maxAttempts: this.maxQrAttempts,
                message: 'Se alcanzó el máximo de intentos para escanear el QR',
                timestamp: new Date().toISOString()
            });

            this.logger.info('WhatsAppWebJsStrategy', 'Connection closed due to QR timeout', {
                connectionId: this.connectionId,
                attempts: this.qrAttempts
            });

            // Notificar al ConnectionManager que debe remover esta conexión
            // Esto evita que la conexión "zombie" permanezca en memoria
            try {
                // Obtener una referencia al ConnectionManager desde el contexto global
                // El ConnectionManager se registra globalmente al inicializarse
                const connectionManager = global.whatsAppConnectionManager;

                if (connectionManager && typeof connectionManager.removeConnection === 'function') {
                    this.logger.info('WhatsAppWebJsStrategy', 'Notifying ConnectionManager to remove connection', {
                        connectionId: this.connectionId
                    });

                    // Remover la conexión del manager de forma asíncrona (sin esperar)
                    setImmediate(async () => {
                        try {
                            await connectionManager.removeConnection(this.connectionId);
                            this.logger.info('WhatsAppWebJsStrategy', 'Connection removed from ConnectionManager', {
                                connectionId: this.connectionId
                            });
                        } catch (removeError) {
                            this.logger.error('WhatsAppWebJsStrategy', 'Error removing connection from manager', removeError, {
                                connectionId: this.connectionId
                            });
                        }
                    });
                } else {
                    this.logger.warn('WhatsAppWebJsStrategy', 'ConnectionManager not available for cleanup', {
                        connectionId: this.connectionId
                    });
                }
            } catch (error) {
                this.logger.error('WhatsAppWebJsStrategy', 'Error notifying ConnectionManager', error, {
                    connectionId: this.connectionId
                });
            }

        } catch (error) {
            this.logger.error('WhatsAppWebJsStrategy', 'Error closing connection due to QR timeout', error, {
                connectionId: this.connectionId
            });
        }
    }

    /**
     * Reinicia el contador de intentos de QR
     */
    resetQRAttempts() {
        this.qrAttempts = 0;

        // También reiniciar el contador del EventHandler para mantener sincronización
        if (this.eventHandler && this.eventHandler.resetQRAttempts) {
            this.eventHandler.resetQRAttempts();
        }

        if (this.qrTimeout) {
            clearTimeout(this.qrTimeout);
            this.qrTimeout = null;
        }

        this.logger.debug('WhatsAppWebJsStrategy', 'QR attempts reset in both Strategy and EventHandler', {
            connectionId: this.connectionId
        });
    }

    /**
     * Verifica si un directorio existe
     * @param {string} dirPath - Ruta del directorio
     * @returns {Promise<boolean>}
     */
    async directoryExists(dirPath) {
        try {
            const stat = await fs.stat(dirPath);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Configura listeners de mensajes (interfaz pública)
     * @param {Function} callback - Callback para mensajes
     * @returns {Promise<void>}
     */
    async onMessage(callback) {
        this.logger.info('WhatsAppWebJsStrategy', 'onMessage called', {
            connectionId: this.connectionId
        });

        if (!this.isClientReady) {
            this.logger.warn('WhatsAppWebJsStrategy', 'Client not ready yet', {
                connectionId: this.connectionId
            });
            return;
        }

        if (!this.messageListenerSetup) {
            this.setupMessageListeners();
        }
    }

    /**
     * Inyecta el WhatsAppBot
     * @param {Object} whatsAppBot - Instancia de WhatsAppBot
     */
    setWhatsAppBot(whatsAppBot) {
        this.messageHandler.setWhatsAppBot(whatsAppBot);
        this.logger.info('WhatsAppWebJsStrategy', 'WhatsAppBot injected');
    }

    /**
     * Inyecta el WhatsAppAdmin
     * @param {Object} whatsAppAdmin - Instancia de WhatsAppAdmin
     */
    setWhatsAppAdmin(whatsAppAdmin) {
        this.messageHandler.setWhatsAppAdmin(whatsAppAdmin);
        this.logger.info('WhatsAppWebJsStrategy', 'WhatsAppAdmin injected');
    }

    /**
     * Envía un mensaje de texto (alias para compatibilidad)
     * @param {string} to - Número de teléfono
     * @param {string} text - Texto a enviar
     * @returns {Promise<void>}
     */
    async sendText(to, text) {
        return await this.sendMessage(to, text);
    }
}

module.exports = WhatsAppWebJsStrategy;