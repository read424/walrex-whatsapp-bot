/**
 * WhatsAppMessageHandler
 *
 * Responsabilidades:
 * - Manejo de mensajes entrantes y salientes de WhatsApp
 * - Filtrado de mensajes (status, grupos, etc.)
 * - Coordinación con WhatsAppBot y WhatsAppAdmin
 * - Guardado de mensajes en base de datos mediante ChatService
 * - Manejo de estados de mensaje (ACK)
 *
 * NO contiene lógica de negocio de bot.
 * Esta es una clase de ADAPTADOR (capa de infraestructura - inbound)
 */

const PHONE_PATTERNS = {
    STATUS_BROADCAST: 'status@broadcast',
    GROUP_CHAT_SUFFIX: '@g.us',
    ADMIN_NUMBERS: ['51935926562@c.us', '51913061289@c.us'] // Configurar según necesidad
};

class WhatsAppMessageHandler {
    /**
     * Constructor con inyección de dependencias
     * @param {Object} dependencies - Dependencias
     * @param {Object} dependencies.chatService - Servicio de chat para persistir mensajes
     * @param {Object} dependencies.logger - Logger
     */
    constructor({ chatService, logger }) {
        if (!chatService || !logger) {
            throw new Error('chatService and logger are required for WhatsAppMessageHandler');
        }

        this.chatService = chatService;
        this.logger = logger;

        // Referencias a componentes que se inyectan después de inicialización
        this.whatsAppBot = null;
        this.whatsAppAdmin = null;
        this.whatsAppClient = null;

        this.logger.info('WhatsAppMessageHandler', 'Message handler initialized successfully');
    }

    /**
     * Configura los message listeners en el cliente de WhatsApp
     * @param {Object} client - Cliente de WhatsApp
     * @param {Object} context - Contexto de la conexión
     */
    setupMessageListeners(client, context) {
        const { connectionId, isClientReady } = context;

        this.logger.info('WhatsAppMessageHandler', 'Setting up message listeners', {
            connectionId,
            isClientReady: isClientReady(),
            hasClient: !!client
        });

        if (!client || !isClientReady()) {
            this.logger.warn('WhatsAppMessageHandler', 'Cannot setup message listeners - client not ready', {
                connectionId,
                hasClient: !!client,
                isClientReady: isClientReady()
            });
            return;
        }

        this.logger.info('WhatsAppMessageHandler', 'Registering message event listener', {
            connectionId,
            clientEvents: client.listenerCount('message')
        });

        // Listener principal de mensajes entrantes
        client.on('message', async (message) => {
            this.logger.info('WhatsAppMessageHandler', 'Raw message received', {
                messageFrom: message.from,
                messageBody: message.body,
                messageType: message.type,
                timestamp: new Date().toISOString(),
                clientId: connectionId
            });

            try {
                // Filtrar mensajes no deseados
                if (this.shouldFilterMessage(message)) {
                    this.logger.debug('WhatsAppMessageHandler', 'Message filtered out', {
                        messageFrom: message.from,
                        reason: 'filtered',
                        connectionId
                    });
                    return;
                }

                this.logger.info('WhatsAppMessageHandler', 'Processing incoming message', {
                    messageFrom: message.from,
                    messageBody: message.body?.substring(0, 50) + '...',
                    connectionId
                });

                // Delegar la lógica al método `handleIncomingMessage`
                await this.handleIncomingMessage(message, context);

            } catch (error) {
                this.logger.error('WhatsAppMessageHandler', 'Error in message listener', error, {
                    messageFrom: message.from,
                    connectionId
                });
            }
        });

        this.logger.info('WhatsAppMessageHandler', 'Message listener successfully attached', {
            connectionId,
            totalMessageListeners: client.listenerCount('message')
        });
    }

    /**
     * Configura los listeners de estado de mensaje (ACK)
     * @param {Object} client - Cliente de WhatsApp
     * @param {Object} context - Contexto de la conexión
     */
    setupMessageStatusListeners(client, context) {
        const { connectionId, isClientReady } = context;

        if (!client || !isClientReady()) {
            this.logger.warn('WhatsAppMessageHandler', 'Cannot setup message status listeners - client not ready', {
                connectionId
            });
            return;
        }

        client.on('message_ack', async (message, ack) => {
            try {
                let status;
                switch (ack) {
                    case 1:
                        status = 1; // sent
                        break;
                    case 2:
                        status = 2; // delivered
                        break;
                    case 3:
                        status = 3; // read
                        break;
                    default:
                        status = 0; // sending
                        break;
                }

                this.logger.debug('WhatsAppMessageHandler', 'Message status updated', {
                    messageId: message.id._serialized,
                    status
                });

                // Actualizar estado en BD
                await this.chatService.updateChatSessionStatus(message.id._serialized, status);

            } catch (error) {
                this.logger.error('WhatsAppMessageHandler', 'Error updating message status', error, {
                    connectionId
                });
            }
        });

        this.logger.info('WhatsAppMessageHandler', 'Message status listeners setup completed', {
            connectionId
        });
    }

    /**
     * Determina si un mensaje debe ser filtrado
     * @param {Object} message - Mensaje de WhatsApp
     * @returns {boolean}
     */
    shouldFilterMessage(message) {
        // Filtrar status broadcasts
        if (message.from === PHONE_PATTERNS.STATUS_BROADCAST) {
            return true;
        }

        // Filtrar grupos
        if (message.from.endsWith(PHONE_PATTERNS.GROUP_CHAT_SUFFIX)) {
            return true;
        }

        // Permitir solo mensajes de números específicos (admin o usuarios permitidos)
        // TODO: Esto debería venir de configuración o base de datos
        const allowedNumbers = [...PHONE_PATTERNS.ADMIN_NUMBERS];
        const isAllowed = allowedNumbers.some(num => message.from.includes(num));

        if (!isAllowed) {
            return true;
        }

        return false;
    }

    /**
     * Determina si un mensaje es de un administrador
     * @param {Object} message - Mensaje de WhatsApp
     * @returns {boolean}
     */
    isAdminMessage(message) {
        return PHONE_PATTERNS.ADMIN_NUMBERS.some(adminNumber =>
            message.from.includes(adminNumber)
        );
    }

    /**
     * Maneja un mensaje entrante
     * @param {Object} message - Mensaje de WhatsApp
     * @param {Object} context - Contexto de la conexión
     */
    async handleIncomingMessage(message, context) {
        const { connectionId, connectionRecord, tenantId } = context;

        this.logger.info('WhatsAppMessageHandler', 'handleIncomingMessage called', {
            messageFrom: message.from,
            messageBody: message.body,
            hasWhatsAppBot: !!this.whatsAppBot,
            hasWhatsAppAdmin: !!this.whatsAppAdmin,
            connectionId
        });

        try {
            // Determinar si es un mensaje de administrador
            const isAdmin = this.isAdminMessage(message);

            if (isAdmin) {
                // Manejar mensaje de administrador
                await this.handleAdminMessage(message);
            } else {
                // Manejar mensaje de usuario normal
                await this.handleUserMessage(message, connectionRecord, tenantId);
            }

        } catch (error) {
            this.logger.error('WhatsAppMessageHandler', 'Error handling incoming message', error, {
                messageFrom: message.from,
                messageBody: message.body
            });

            // No lanzar el error para evitar que se propague
            this.logger.warn('WhatsAppMessageHandler', 'Message handling failed, continuing...', {
                messageFrom: message.from
            });
        }
    }

    /**
     * Maneja un mensaje de administrador
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleAdminMessage(message) {
        if (!this.whatsAppAdmin) {
            this.logger.warn('WhatsAppMessageHandler', 'WhatsAppAdmin not initialized', {
                messageFrom: message.from
            });
            return;
        }

        this.logger.info('WhatsAppMessageHandler', 'Processing admin message', {
            messageFrom: message.from,
            command: message.body
        });

        await this.whatsAppAdmin.handleMessage(message);
    }

    /**
     * Maneja un mensaje de usuario normal
     * @param {Object} message - Mensaje de WhatsApp
     * @param {Object} connectionRecord - Registro de conexión
     * @param {string} tenantId - ID del tenant
     */
    async handleUserMessage(message, connectionRecord, tenantId) {
        // Guardar mensaje en base de datos usando ChatService
        const chatData = await this.chatService.processIncomingMessage(
            message,
            connectionRecord.id,
            tenantId
        );

        this.logger.info('WhatsAppMessageHandler', 'Message saved to database', {
            messageId: chatData.message.id,
            sessionId: chatData.chatSession.id,
            contactPhone: chatData.contact.phoneNumber
        });

        // Procesar con WhatsAppBot
        if (!this.whatsAppBot) {
            this.logger.warn('WhatsAppMessageHandler', 'WhatsAppBot not initialized', {
                messageFrom: message.from
            });
            return;
        }

        this.logger.info('WhatsAppMessageHandler', 'Delegating to WhatsAppBot', {
            messageFrom: message.from
        });

        await this.whatsAppBot.handleMessage(message);
    }

    /**
     * Establece el WhatsAppBot
     * @param {Object} whatsAppBot - Instancia de WhatsAppBot
     */
    setWhatsAppBot(whatsAppBot) {
        this.whatsAppBot = whatsAppBot;
        this.logger.info('WhatsAppMessageHandler', 'WhatsAppBot injected successfully');
    }

    /**
     * Establece el WhatsAppAdmin
     * @param {Object} whatsAppAdmin - Instancia de WhatsAppAdmin
     */
    setWhatsAppAdmin(whatsAppAdmin) {
        this.whatsAppAdmin = whatsAppAdmin;
        this.logger.info('WhatsAppMessageHandler', 'WhatsAppAdmin injected successfully');
    }

    /**
     * Establece el cliente de WhatsApp
     * @param {Object} whatsAppClient - Cliente de WhatsApp (strategy)
     */
    setWhatsAppClient(whatsAppClient) {
        this.whatsAppClient = whatsAppClient;
        this.logger.info('WhatsAppMessageHandler', 'WhatsAppClient injected successfully');
    }

    /**
     * Obtiene el estado de los listeners (para debugging)
     * @param {Object} client - Cliente de WhatsApp
     * @param {Object} context - Contexto
     * @returns {Object}
     */
    getListenerStatus(client, context) {
        const { connectionId, isClientReady, isLoggedIn } = context;

        return {
            clientId: connectionId,
            hasClient: !!client,
            isClientReady: isClientReady(),
            totalMessageListeners: client ? client.listenerCount('message') : 0,
            isLoggedIn: isLoggedIn(),
            hasWhatsAppBot: !!this.whatsAppBot,
            hasWhatsAppAdmin: !!this.whatsAppAdmin
        };
    }
}

module.exports = WhatsAppMessageHandler;