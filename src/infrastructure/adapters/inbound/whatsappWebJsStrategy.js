const { Client, LocalAuth } = require('whatsapp-web.js');
const WhatsAppConnectionPort = require('../../../application/ports/output/WhatsAppConnectionPort');
const { ChannelConnection } = require('../outbound/persistence/entity');
const path = require('path');
const fs = require('fs').promises;

class WhatsAppWebJsStrategy extends WhatsAppConnectionPort {
    /**
     * Constructor con inyección de dependencias
     * @param {Object} dependencies - Dependencias
     * @param {Object} dependencies.eventHandler - Manejador de eventos
     * @param {Object} dependencies.messageHandler - Manejador de mensajes
     * @param {Object} dependencies.chatService - Servicio de chat
     * @param {Object} dependencies.webSocketAdapter - Adaptador WebSocket
     * @param {Object} dependencies.logger - Logger
     * @param {string} dependencies.connectionId - ID de conexión
     * @param {string} dependencies.tenantId - ID del tenant
     */
    constructor({
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
        if (!eventHandler ||
            !messageHandler || !chatService || !webSocketAdapter || !logger) {
            throw new Error('All dependencies are required for WhatsAppWebJsStrategy');
        }

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

            this.logger.info('WhatsAppWebJsStrategy', 'Initializing WhatsApp client', {
                tenantId: this.tenantId,
                dataPath: this.sessionBasePath
            });

            // Buscar o crear registro en la base de datos
            await this.ensureConnectionRecord();

            const sanitizedClientId = this.connectionName
                ? this.connectionName.replace(/[^a-zA-Z0-9_-]/g, '_')
                : `connection_${this.connectionId}`;

            this.logger.info('WhatsAppWebJsStrategy', 'LocalAuth configuration', {
                connectionId: this.connectionId,
                originalConnectionName: this.connectionName,
                sanitizedClientId
            });

            // Crear cliente de WhatsApp con configuración mejorada para estabilidad
            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: sanitizedClientId
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
            this.client.on('error', async (error) => {
                this.logger.error('WhatsAppWebJsStrategy', 'WhatsApp client error', error, {
                    connectionId: this.connectionId
                });

                // Actualizar el estado de la conexión en la base de datos
                try {
                    if (!this.connectionRecord)
                        throw new Error(`Connection record not found for connectionId: ${this.connectionId}. Cannot update status to error.`);

                    const errorMessage = error?.message || error?.toString() || 'Unknown WhatsApp client error';
                    await this.connectionRecord.updateStatus('error', errorMessage);

                    this.logger.info('WhatsAppWebJsStrategy', 'Connection status updated to error', {
                        connectionId: this.connectionId,
                        error: errorMessage
                    });
                } catch (updateError) {
                    this.logger.error('WhatsAppWebJsStrategy', 'Failed to update connection status', updateError, {
                        connectionId: this.connectionId
                    });
                }
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
            const channelConnection = await ChannelConnection.findByPk(this.connectionId);

            if (!channelConnection) {
                throw new Error(`Connection record not found for ID: ${this.connectionId}`);
            }

            this.logger.info('WhatsAppWebJsStrategy', 'Found connection in channel_connections', {
                connectionId: this.connectionId,
                connectionName: channelConnection.connection_name,
                status: channelConnection.status
            });

            // Guardar referencia y nombre de conexión
            this.connectionRecord = channelConnection;
            this.connectionName = channelConnection.connection_name;

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

            // Actualizar estado en la base de datos usando Active Record
            if (this.connectionRecord) {
                await ChannelConnection.update(
                    { status: 'disconnected' },
                    { where: { id: this.connectionId } }
                );
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
            // Limpiar metadata en channel_connections usando Active Record
            const connection = await ChannelConnection.findByPk(this.connectionId);
            if (connection) {
                connection.connection_metadata = {
                    ...connection.connection_metadata,
                    qrCode: null,
                    phoneNumber: null,
                    deviceInfo: null
                };
                await connection.save();

                connection.status = 'inactive';
                await connection.save();
            }

            if (!this.connectionName) return;

            // Sanitizar connectionName igual que en init()
            const sanitizedConnectionName = this.connectionName.replace(/[^a-zA-Z0-9_-]/g, '_');

            const authSessionDir = path.join(this.sessionBasePath, `session-${sanitizedConnectionName}`);

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

            // MODIFICACIÓN: Resolver la promesa de QR para evitar que el endpoint se quede colgado
            if (this.qrPromiseResolve) {
                this.logger.info('WhatsAppWebJsStrategy', 'Resolving QR promise due to timeout', {
                    connectionId: this.connectionId
                });
                this.qrPromiseResolve(null); // Resolvemos con null para indicar fallo/timeout
                this.qrPromiseResolve = null;
                this.qrPromise = null;
            }

        } catch (error) {
            this.logger.error('WhatsAppWebJsStrategy', 'Error closing connection due to QR timeout', error, {
                connectionId: this.connectionId
            });

            // Asegurar que la promesa se resuelva incluso si hay error
            if (this.qrPromiseResolve) {
                this.qrPromiseResolve(null);
                this.qrPromiseResolve = null;
                this.qrPromise = null;
            }
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
     * Verifica si existe una sesión guardada para restaurar
     * @param {string} connectionName - Nombre de la conexión
     * @returns {Promise<boolean>} - true si existe sesión, false si no
     */
    async restoreSessionIfExists(connectionName) {
        try {
            if (!connectionName) {
                this.logger.warn('WhatsAppWebJsStrategy', 'Cannot check for session without connection name');
                return false;
            }

            // Sanitizar connectionName igual que en init()
            const sanitizedConnectionName = connectionName.replace(/[^a-zA-Z0-9_-]/g, '_');

            // Verificar si existe la carpeta de sesión en .wwebjs_auth
            const sessionPath = path.join(process.cwd(), '.wwebjs_auth', `session-${sanitizedConnectionName}`);

            this.logger.info('WhatsAppWebJsStrategy', 'Checking for existing session', {
                originalConnectionName: connectionName,
                sanitizedConnectionName,
                sessionPath
            });

            const sessionExists = await this.directoryExists(sessionPath);

            if (sessionExists) {
                this.logger.info('WhatsAppWebJsStrategy', 'Existing session found', {
                    connectionName: sanitizedConnectionName,
                    sessionPath
                });
            } else {
                this.logger.info('WhatsAppWebJsStrategy', 'No existing session found', {
                    connectionName: sanitizedConnectionName,
                    sessionPath
                });
            }

            return sessionExists;

        } catch (error) {
            this.logger.error('WhatsAppWebJsStrategy', 'Error checking for existing session', error, {
                connectionName
            });
            return false;
        }
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