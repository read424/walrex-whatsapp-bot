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

            // Crear cliente de WhatsApp
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
                        '--disable-extensions'
                    ],
                    timeout: 90000
                }
            });

            // Configurar event listeners usando el EventHandler
            this.setupEventListeners();

            // Inicializar cliente
            await this.client.initialize();

            this.logger.info('WhatsAppWebJsStrategy', 'WhatsApp client initialization started', {
                connectionId: this.connectionId
            });

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
            await this.client.destroy();
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
        this.qrAttempts++;

        this.logger.info('WhatsAppWebJsStrategy', 'QR timeout occurred', {
            connectionId: this.connectionId,
            attempts: this.qrAttempts,
            maxAttempts: this.maxQrAttempts
        });

        if (this.qrAttempts >= this.maxQrAttempts) {
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

            if (this.client) {
                await this.client.destroy();
                this.client = null;
            }

            this.isLoggedIn = false;
            this.currentQR = null;

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
        if (this.qrTimeout) {
            clearTimeout(this.qrTimeout);
            this.qrTimeout = null;
        }
        this.logger.debug('WhatsAppWebJsStrategy', 'QR attempts reset', {
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