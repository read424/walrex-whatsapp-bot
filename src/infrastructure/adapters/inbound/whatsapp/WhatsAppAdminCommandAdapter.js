/**
 * Adaptador de comandos administrativos de WhatsApp
 *
 * Responsabilidades:
 * - Recibir mensajes de WhatsApp
 * - Parsear comandos
 * - Delegar a casos de uso apropiados
 * - Formatear respuestas usando WhatsAppMessageFormatter
 * - Enviar mensajes de respuesta
 *
 * NO contiene lógica de negocio.
 * Esta es una clase de ADAPTADOR (capa de infraestructura - inbound)
 */
class WhatsAppAdminCommandAdapter {
    /**
     * Constructor con inyección de dependencias
     * @param {Object} dependencies - Dependencias
     * @param {Object} dependencies.getActivePricesUseCase - Caso de uso para obtener precios
     * @param {Object} dependencies.getTradingConfigUseCase - Caso de uso para obtener config
     * @param {Object} dependencies.formatter - Formateador de mensajes WhatsApp
     * @param {Object} dependencies.logger - Logger
     */
    constructor({ getActivePricesUseCase, getTradingConfigUseCase, formatter, logger }) {
        if (!getActivePricesUseCase || !getTradingConfigUseCase || !formatter || !logger) {
            throw new Error('All dependencies are required');
        }

        this.getActivePricesUseCase = getActivePricesUseCase;
        this.getTradingConfigUseCase = getTradingConfigUseCase;
        this.formatter = formatter;
        this.logger = logger;
        this.whatsappClient = null;

        this.logger.info('WhatsAppAdminCommandAdapter', 'Adapter initialized successfully');
    }

    /**
     * Establece el cliente de WhatsApp
     * @param {Object} clientStrategy - Estrategia del cliente WhatsApp
     */
    setWhatsAppClient(clientStrategy) {
        this.whatsappClient = clientStrategy;
        this.logger.info('WhatsAppAdminCommandAdapter', 'WhatsApp client set successfully');
    }

    /**
     * Maneja un mensaje entrante del administrador
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleMessage(message) {
        try {
            this.logger.info('WhatsAppAdminCommandAdapter', 'Handling admin message', {
                from: message.from,
                bodyPreview: message.body?.substring(0, 50)
            });

            const command = message.body?.trim().toLowerCase();
            await this.processCommand(command, message);

        } catch (error) {
            this.logger.error('WhatsAppAdminCommandAdapter', 'Error handling admin message', error, {
                from: message.from
            });

            // Enviar mensaje de error al usuario
            await this.sendMessage(
                message.from,
                this.formatter.formatErrorMessage(message.body?.trim() || 'unknown')
            );
        }
    }

    /**
     * Procesa el comando recibido
     * @param {string} command - Comando a procesar
     * @param {Object} message - Mensaje original
     */
    async processCommand(command, message) {
        const commandHandlers = {
            'tasa_precio': () => this.handleTasaPrecioCommand(message),
            'trading_config': () => this.handleTradingConfigCommand(message),
            'status': () => this.handleStatusCommand(message),
            'help': () => this.handleHelpCommand(message),
            'clear_cache': () => this.handleClearCacheCommand(message),
            'system_info': () => this.handleSystemInfoCommand(message)
        };

        const handler = commandHandlers[command];

        if (handler) {
            await handler();
        } else {
            await this.sendMessage(message.from, this.formatter.formatAvailableCommands());
        }
    }

    /**
     * Maneja el comando tasa_precio
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleTasaPrecioCommand(message) {
        try {
            this.logger.info('WhatsAppAdminCommandAdapter', 'Processing tasa_precio command', {
                from: message.from
            });

            // Delegar al caso de uso
            const result = await this.getActivePricesUseCase.execute({ idCompany: 1 });

            // Formatear respuesta según la fuente
            let formattedMessage;
            if (result.source === 'database') {
                formattedMessage = this.formatter.formatActivePrices(result.prices);
            } else if (result.source === 'binance') {
                formattedMessage = this.formatter.formatBinanceRates(result.prices);
            } else {
                formattedMessage = this.formatter.formatWarningMessage('No se encontraron precios disponibles');
            }

            await this.sendMessage(message.from, formattedMessage);

        } catch (error) {
            this.logger.error('WhatsAppAdminCommandAdapter', 'Error in tasa_precio command', error);

            if (error.message === 'TradingAdapter not available') {
                await this.sendMessage(
                    message.from,
                    this.formatter.formatWarningMessage('Servicio de Trading no disponible. Contacte al equipo técnico.')
                );
            } else if (error.message === 'No trading currencies configured') {
                await this.sendMessage(
                    message.from,
                    this.formatter.formatWarningMessage('No hay monedas configuradas para trading.')
                );
            } else {
                await this.sendMessage(
                    message.from,
                    this.formatter.formatErrorMessage('tasa_precio')
                );
            }
        }
    }

    /**
     * Maneja el comando trading_config
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleTradingConfigCommand(message) {
        try {
            this.logger.info('WhatsAppAdminCommandAdapter', 'Processing trading_config command', {
                from: message.from
            });

            // Delegar al caso de uso
            const tradingConfig = await this.getTradingConfigUseCase.execute({ idCompany: 1 });

            if (tradingConfig.length > 0) {
                const formattedMessage = this.formatter.formatTradingConfig(tradingConfig);
                await this.sendMessage(message.from, formattedMessage);
            } else {
                await this.sendMessage(
                    message.from,
                    this.formatter.formatWarningMessage('No hay configuración de trading activa.')
                );
            }

        } catch (error) {
            this.logger.error('WhatsAppAdminCommandAdapter', 'Error in trading_config command', error);
            await this.sendMessage(message.from, this.formatter.formatErrorMessage('trading_config'));
        }
    }

    /**
     * Maneja el comando status
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleStatusCommand(message) {
        try {
            this.logger.info('WhatsAppAdminCommandAdapter', 'Processing status command', {
                from: message.from
            });

            // Datos de estado del sistema (esto podría venir de un caso de uso si se vuelve más complejo)
            const status = {
                uptime: process.uptime ? `${Math.floor(process.uptime() / 60)} minutos` : 'N/A',
                memory: process.memoryUsage ? `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB` : 'N/A',
                connections: 0 // TODO: Obtener de ConnectionManager
            };

            const formattedMessage = this.formatter.formatSystemStatus(status);
            await this.sendMessage(message.from, formattedMessage);

        } catch (error) {
            this.logger.error('WhatsAppAdminCommandAdapter', 'Error in status command', error);
            await this.sendMessage(message.from, this.formatter.formatErrorMessage('status'));
        }
    }

    /**
     * Maneja el comando help
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleHelpCommand(message) {
        try {
            this.logger.info('WhatsAppAdminCommandAdapter', 'Processing help command', {
                from: message.from
            });

            const formattedMessage = this.formatter.formatHelpMessage();
            await this.sendMessage(message.from, formattedMessage);

        } catch (error) {
            this.logger.error('WhatsAppAdminCommandAdapter', 'Error in help command', error);
            await this.sendMessage(message.from, this.formatter.formatErrorMessage('help'));
        }
    }

    /**
     * Maneja el comando clear_cache
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleClearCacheCommand(message) {
        try {
            this.logger.info('WhatsAppAdminCommandAdapter', 'Processing clear_cache command', {
                from: message.from
            });

            // TODO: Implementar caso de uso para limpiar caché cuando sea necesario
            await this.sendMessage(
                message.from,
                this.formatter.formatWarningMessage('Comando clear_cache no implementado aún.')
            );

        } catch (error) {
            this.logger.error('WhatsAppAdminCommandAdapter', 'Error in clear_cache command', error);
            await this.sendMessage(message.from, this.formatter.formatErrorMessage('clear_cache'));
        }
    }

    /**
     * Maneja el comando system_info
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleSystemInfoCommand(message) {
        try {
            this.logger.info('WhatsAppAdminCommandAdapter', 'Processing system_info command', {
                from: message.from
            });

            const systemInfo = `🖥️ *INFORMACIÓN DEL SISTEMA*

📦 Node.js: ${process.version}
🏗️ Plataforma: ${process.platform}
⚙️ Arquitectura: ${process.arch}
⏱️ Uptime: ${Math.floor(process.uptime() / 60)} minutos
💾 Memoria: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB

🤖 Bot Walrex App v1.0`;

            await this.sendMessage(message.from, systemInfo);

        } catch (error) {
            this.logger.error('WhatsAppAdminCommandAdapter', 'Error in system_info command', error);
            await this.sendMessage(message.from, this.formatter.formatErrorMessage('system_info'));
        }
    }

    /**
     * Envía un mensaje por WhatsApp
     * @param {string} to - Destinatario
     * @param {string} message - Mensaje a enviar
     */
    async sendMessage(to, message) {
        try {
            if (!this.whatsappClient) {
                this.logger.warn('WhatsAppAdminCommandAdapter', 'Cannot send message: WhatsApp client not set');
                return;
            }

            await this.whatsappClient.sendText(to, message);

            this.logger.info('WhatsAppAdminCommandAdapter', 'Message sent successfully', {
                to,
                messageLength: message.length
            });

        } catch (error) {
            this.logger.error('WhatsAppAdminCommandAdapter', 'Error sending message', error, { to });
            throw error;
        }
    }
}

module.exports = WhatsAppAdminCommandAdapter;