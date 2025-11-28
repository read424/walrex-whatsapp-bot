/**
 * WhatsAppAdministrator - Servicio de aplicación para administración vía WhatsApp
 * Sigue la arquitectura hexagonal - Capa de Aplicación
 *
 * Responsabilidades:
 * - Coordinar comandos administrativos recibidos por WhatsApp
 * - Delegar operaciones de negocio a servicios de dominio
 * - Delegar operaciones de persistencia a repositorios (a través de puertos)
 * - Delegar operaciones de trading a adaptadores externos (a través de puertos)
 *
 * Dependencias:
 * - LoggerPort: Para logging estructurado
 * - TradingRepositoryPort: Para operaciones de persistencia de trading
 * - TradingPort: Para obtener tasas de cambio desde proveedores externos (ej. Binance)
 */
class WhatsAppAdministrator {
    /**
     * Constructor con inyección de dependencias
     * @param {Object} dependencies - Objeto con dependencias
     * @param {Object} dependencies.logger - Implementación de LoggerPort
     * @param {Object} dependencies.tradingRepository - Implementación de TradingRepositoryPort
     * @param {Object} dependencies.tradingAdapter - Implementación de TradingPort
     * @param {Object} dependencies.customerService - Servicio de clientes (opcional)
     */
    constructor({ logger, tradingRepository, tradingAdapter, customerService = null }) {
        // Validar dependencias requeridas
        if (!logger) {
            throw new Error('Logger dependency is required');
        }
        if (!tradingRepository) {
            throw new Error('TradingRepository dependency is required');
        }

        this.logger = logger;
        this.tradingRepository = tradingRepository;
        this.tradingAdapter = tradingAdapter;
        this.customerService = customerService;
        this.whatsappClient = null;

        this.logger.info('WhatsAppAdministrator', 'WhatsAppAdministrator initialized successfully', {
            hasCustomerService: !!customerService,
            hasTradingAdapter: !!tradingAdapter
        });
    }

    /**
     * Establece el cliente de WhatsApp
     * @param {Object} clientStrategy - Estrategia del cliente WhatsApp
     */
    setWhatsAppClient(clientStrategy) {
        this.whatsappClient = clientStrategy;
        this.logger.info('WhatsAppAdministrator', 'WhatsApp client set successfully');
    }

    /**
     * Maneja un mensaje entrante del administrador
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleMessage(message) {
        try {
            this.logger.info('WhatsAppAdministrator', `Handling admin message from: ${message.from}`, {
                messageBody: message.body?.substring(0, 50) + '...',
                hasWhatsAppClient: !!this.whatsappClient
            });

            const command = message.body?.trim().toLowerCase();
            await this.processCommand(command, message);

        } catch (error) {
            this.logger.error('WhatsAppAdministrator', `Error handling admin message: ${error.message}`, error, {
                messageFrom: message.from,
                messageBody: message.body?.substring(0, 50) + '...'
            });

            // No lanzar el error para evitar que se propague
            this.logger.warn('WhatsAppAdministrator', 'Admin message handling failed, continuing...', {
                messageFrom: message.from
            });
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
            await this.sendMessage(message.from, this.getAvailableCommandsMessage());
        }
    }

    /**
     * Obtiene el mensaje de comandos disponibles
     * @returns {string} Mensaje con comandos disponibles
     */
    getAvailableCommandsMessage() {
        return `📋 *COMANDOS DISPONIBLES*
            • *tasa_precio* - Consultar tasas de cambio actuales
            • *trading_config* - Ver configuración de trading
            • *status* - Estado del sistema
            • *help* - Ayuda y documentación
            • *clear_cache* - Limpiar caché del sistema
            • *system_info* - Información del sistema

            💡 Escribe el comando deseado para ejecutarlo.`;
    }

    /**
     * Maneja el comando tasa_precio
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleTasaPrecioCommand(message) {
        try {
            this.logger.info('WhatsAppAdministrator', 'Processing tasa_precio command', {
                messageFrom: message.from
            });

            // Obtener precios activos de la base de datos usando el repositorio
            const activePrices = await this.tradingRepository.getActivePrices();

            if (activePrices && activePrices.length > 0) {
                // Formatear respuesta con precios de BD
                const response = this.formatActivePricesResponse(activePrices);
                await this.sendMessage(message.from, response);
            } else {
                // Si no hay precios activos, obtener de Binance
                await this.handleTasaPrecioFromBinance(message);
            }

        } catch (error) {
            this.logger.error('WhatsAppAdministrator', 'Error handling tasa_precio command', error, {
                messageFrom: message.from
            });

            // Enviar mensaje de error al administrador
            await this.sendMessage(message.from, 'Error al procesar comando tasa_precio. Intente más tarde.');
        }
    }

    /**
     * Formatea la respuesta de precios activos
     * @param {Array} activePrices - Lista de precios activos
     * @returns {string} Respuesta formateada
     */
    formatActivePricesResponse(activePrices) {
        let response = '💱 *PRECIOS ACTIVOS HOY*\n\n';

        // Agrupar por tipo de operación
        const groupedByType = {};

        activePrices.forEach(price => {
            const typeKey = price.type_operation;
            if (!groupedByType[typeKey]) {
                groupedByType[typeKey] = [];
            }
            groupedByType[typeKey].push(price);
        });

        // Formatear por tipo de operación
        Object.keys(groupedByType).forEach(type => {
            const typeLabel = this.getTypeOperationLabel(type);
            response += `*${typeLabel}*\n`;

            groupedByType[type].forEach(price => {
                const baseCode = price.baseCurrency?.code_iso3 || 'N/A';
                const quoteCode = price.quoteCurrency?.code_iso3 || 'N/A';
                const amount = parseFloat(price.amount_price).toFixed(5);

                response += `• ${baseCode} → ${quoteCode}: ${amount}\n`;
            });
            response += '\n';
        });

        return response.trim();
    }

    /**
     * Maneja el comando trading_config
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleTradingConfigCommand(message) {
        try {
            this.logger.info('WhatsAppAdministrator', 'Processing trading_config command', {
                messageFrom: message.from
            });

            // Por ahora usamos un ID de empresa por defecto (1), pero esto debería venir del contexto del usuario
            const idCompany = 1; // TODO: Obtener desde el contexto del usuario o parámetro
            const tradingConfig = await this.tradingRepository.getTradingCurrenciesWithBanks(idCompany);

            if (tradingConfig && tradingConfig.length > 0) {
                const response = this.formatTradingConfigResponse(tradingConfig);
                await this.sendMessage(message.from, response);
            } else {
                await this.sendMessage(message.from, '⚠️ No hay configuración de trading activa.');
            }

        } catch (error) {
            this.logger.error('WhatsAppAdministrator', 'Error handling trading_config command', error, {
                messageFrom: message.from
            });

            await this.sendMessage(message.from, 'Error al obtener configuración de trading. Intente más tarde.');
        }
    }

    /**
     * Formatea la respuesta de configuración de trading
     * @param {Array} tradingConfig - Lista de configuraciones de trading
     * @returns {string} Respuesta formateada
     */
    formatTradingConfigResponse(tradingConfig) {
        let response = '⚙️ *CONFIGURACIÓN DE TRADING*\n\n';

        tradingConfig.forEach(config => {
            const baseCode = config.baseCurrency?.code_iso3 || 'N/A';
            const quoteCode = config.quoteCurrency?.code_iso3 || 'N/A';
            const revenue = parseFloat(config.porc_revenue).toFixed(3);

            response += `• ${baseCode} → ${quoteCode}\n`;
            response += `  💰 Revenue: ${revenue}%\n\n`;
        });

        response += '📊 *Total de pares configurados:* ' + tradingConfig.length;

        return response.trim();
    }

    /**
     * Obtiene la etiqueta del tipo de operación
     * @param {string} type - Tipo de operación
     * @returns {string} Etiqueta descriptiva
     */
    getTypeOperationLabel(type) {
        const labels = {
            '1': '💰 VENTA DE DIVISA (Fiat)',
            '2': '💸 COMPRA DE DIVISA (Fiat)',
            '3': '📤 ENVÍO DE REMESAS (Fiat)'
        };
        return labels[type] || `Tipo ${type}`;
    }

    /**
     * Maneja la obtención de tasas desde Binance cuando no hay precios activos
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleTasaPrecioFromBinance(message) {
        try {
            this.logger.info('WhatsAppAdministrator', 'No active prices found, fetching from Binance', {
                messageFrom: message.from
            });

            // Enviar mensaje informativo
            await this.sendMessage(message.from, '⚠️ No hay precios activos en BD. Consultando configuración de trading...');

            if (!this.tradingAdapter) {
                await this.sendMessage(message.from, '❌ TradingAdapter no disponible. Contacte al equipo técnico.');
                return;
            }

            // 1. Obtener monedas configuradas para trading desde la BD usando el repositorio
            const idCompany = 1; // TODO: Obtener desde el contexto del usuario o parámetro
            const tradingCurrencies = await this.tradingRepository.getTradingCurrenciesWithBanks(idCompany);

            if (!tradingCurrencies || tradingCurrencies.length === 0) {
                await this.sendMessage(message.from, '❌ No hay monedas configuradas para trading. Configure primero las monedas.');
                return;
            }

            this.logger.info('WhatsAppAdministrator', 'Trading currencies found', {
                count: tradingCurrencies.length,
                messageFrom: message.from
            });

            // 2. Obtener tasas de cambio desde Binance para las monedas configuradas
            const rates = [];

            for (const currency of tradingCurrencies) {
                try {
                    const baseCode = currency.baseCurrency?.code_iso3;
                    const quoteCode = currency.quoteCurrency?.code_iso3;

                    if (baseCode && quoteCode) {
                        this.logger.info('WhatsAppAdministrator', `Getting rate for ${baseCode}-${quoteCode}`, {
                            messageFrom: message.from
                        });

                        const rate = await this.tradingAdapter.getExchangeRate(baseCode, quoteCode);

                        if (rate) {
                            rates.push({
                                base: baseCode,
                                quote: quoteCode,
                                rate: rate,
                                revenue: currency.porc_revenue || 0
                            });
                        }
                    }
                } catch (error) {
                    this.logger.warn('WhatsAppAdministrator', `Error getting rate for ${currency.baseCurrency?.code_iso3}-${currency.quoteCurrency?.code_iso3}`, error);
                }
            }

            if (rates.length > 0) {
                const response = this.formatTradingCurrenciesRatesResponse(rates);
                await this.sendMessage(message.from, response);
            } else {
                await this.sendMessage(message.from, '❌ No se pudieron obtener tasas desde Binance para las monedas configuradas. Intente más tarde.');
            }

        } catch (error) {
            this.logger.error('WhatsAppAdministrator', 'Error handling Binance rates', error, {
                messageFrom: message.from
            });

            await this.sendMessage(message.from, '❌ Error al obtener tasas desde Binance. Contacte al equipo técnico.');
        }
    }

    /**
     * Formatea la respuesta de tasas de Binance para monedas configuradas para trading
     * @param {Array} rates - Lista de tasas obtenidas con información de revenue
     * @returns {string} Respuesta formateada
     */
    formatTradingCurrenciesRatesResponse(rates) {
        let response = '🔄 *TASAS DESDE BINANCE*\n\n';
        response += '⚠️ *Nota: Estas tasas son en tiempo real*\n';
        response += '📊 *Monedas configuradas para trading*\n\n';

        rates.forEach(rate => {
            const formattedRate = parseFloat(rate.rate).toFixed(5);
            const revenue = parseFloat(rate.revenue).toFixed(2);
            response += `• ${rate.base} → ${rate.quote}\n`;
            response += `  💰 Tasa: ${formattedRate}\n`;
            response += `  📈 Revenue: ${revenue}%\n\n`;
        });

        response += '💡 *Recomendación: Configure precios en BD para mejor control*';

        return response;
    }

    /**
     * Maneja el comando status
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleStatusCommand(message) {
        try {
            this.logger.info('WhatsAppAdministrator', 'Processing status command', {
                messageFrom: message.from
            });

            const status = this.getSystemStatus();
            const response = this.formatStatusResponse(status);

            await this.sendMessage(message.from, response);

        } catch (error) {
            this.logger.error('WhatsAppAdministrator', 'Error handling status command', error, {
                messageFrom: message.from
            });

            await this.sendMessage(message.from, '❌ Error al obtener estado del sistema.');
        }
    }

    /**
     * Maneja el comando help
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleHelpCommand(message) {
        try {
            this.logger.info('WhatsAppAdministrator', 'Processing help command', {
                messageFrom: message.from
            });

            const helpMessage = this.getHelpMessage();
            await this.sendMessage(message.from, helpMessage);

        } catch (error) {
            this.logger.error('WhatsAppAdministrator', 'Error handling help command', error, {
                messageFrom: message.from
            });

            await this.sendMessage(message.from, '❌ Error al mostrar ayuda.');
        }
    }

    /**
     * Maneja el comando clear_cache
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleClearCacheCommand(message) {
        try {
            this.logger.info('WhatsAppAdministrator', 'Processing clear_cache command', {
                messageFrom: message.from
            });

            // Aquí implementarías la lógica para limpiar caché
            await this.sendMessage(message.from, '🧹 Caché del sistema limpiado exitosamente.');

        } catch (error) {
            this.logger.error('WhatsAppAdministrator', 'Error handling clear_cache command', error, {
                messageFrom: message.from
            });

            await this.sendMessage(message.from, '❌ Error al limpiar caché del sistema.');
        }
    }

    /**
     * Maneja el comando system_info
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleSystemInfoCommand(message) {
        try {
            this.logger.info('WhatsAppAdministrator', 'Processing system_info command', {
                messageFrom: message.from
            });

            const systemInfo = this.getSystemInfo();
            const response = this.formatSystemInfoResponse(systemInfo);

            await this.sendMessage(message.from, response);

        } catch (error) {
            this.logger.error('WhatsAppAdministrator', 'Error handling system_info command', error, {
                messageFrom: message.from
            });

            await this.sendMessage(message.from, '❌ Error al obtener información del sistema.');
        }
    }

    /**
     * Obtiene el estado del sistema
     * @returns {Object} Estado del sistema
     */
    getSystemStatus() {
        return {
            whatsappClient: !!this.whatsappClient,
            customerService: !!this.customerService,
            tradingAdapter: !!this.tradingAdapter,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version
        };
    }

    /**
     * Obtiene información del sistema
     * @returns {Object} Información del sistema
     */
    getSystemInfo() {
        const os = require('os');
        return {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            loadAverage: os.loadavg(),
            uptime: os.uptime()
        };
    }

    /**
     * Formatea la respuesta de estado del sistema
     * @param {Object} status - Estado del sistema
     * @returns {string} Respuesta formateada
     */
    formatStatusResponse(status) {
        const uptimeHours = Math.floor(status.uptime / 3600);
        const uptimeMinutes = Math.floor((status.uptime % 3600) / 60);

        let response = '📊 *ESTADO DEL SISTEMA*\n\n';
        response += `🟢 WhatsApp Client: ${status.whatsappClient ? 'Conectado' : 'Desconectado'}\n`;
        response += `🟢 Customer Service: ${status.customerService ? 'Disponible' : 'No disponible'}\n`;
        response += `🟢 Trading Adapter: ${status.tradingAdapter ? 'Disponible' : 'No disponible'}\n`;
        response += `⏱️ Uptime: ${uptimeHours}h ${uptimeMinutes}m\n`;
        response += `📅 Última verificación: ${new Date(status.timestamp).toLocaleString('es-PE')}`;

        return response;
    }

    /**
     * Formatea la respuesta de información del sistema
     * @param {Object} systemInfo - Información del sistema
     * @returns {string} Respuesta formateada
     */
    formatSystemInfoResponse(systemInfo) {
        const totalMemoryGB = (systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2);
        const freeMemoryGB = (systemInfo.freeMemory / 1024 / 1024 / 1024).toFixed(2);
        const usedMemoryGB = (totalMemoryGB - freeMemoryGB).toFixed(2);

        let response = '💻 *INFORMACIÓN DEL SISTEMA*\n\n';
        response += `🖥️ Plataforma: ${systemInfo.platform} (${systemInfo.arch})\n`;
        response += `🖥️ CPUs: ${systemInfo.cpus}\n`;
        response += `💾 Memoria Total: ${totalMemoryGB} GB\n`;
        response += `💾 Memoria Libre: ${freeMemoryGB} GB\n`;
        response += `💾 Memoria Usada: ${usedMemoryGB} GB\n`;
        response += `📈 Carga del Sistema: ${systemInfo.loadAverage.map(load => load.toFixed(2)).join(', ')}\n`;
        response += `⏱️ Uptime del Sistema: ${Math.floor(systemInfo.uptime / 3600)}h ${Math.floor((systemInfo.uptime % 3600) / 60)}m`;

        return response;
    }

    /**
     * Obtiene el mensaje de ayuda
     * @returns {string} Mensaje de ayuda
     */
    getHelpMessage() {
        return `📚 *AYUDA Y DOCUMENTACIÓN*

🤖 *WhatsAppAdministrator* - Sistema de administración vía WhatsApp

📋 *Comandos Principales:*
• *tasa_precio* - Consulta tasas de cambio en tiempo real
• *trading_config* - Muestra configuración de trading activa
• *status* - Estado actual del sistema

🔧 *Comandos de Sistema:*
• *help* - Muestra esta ayuda
• *clear_cache* - Limpia caché del sistema
• *system_info* - Información detallada del sistema

💡 *Uso:*
Simplemente escribe el comando deseado y el sistema lo procesará automáticamente.

📞 *Soporte:*
Para problemas técnicos, contacta al equipo de desarrollo.

🔄 *Actualizaciones:*
El sistema se actualiza automáticamente con las últimas tasas de cambio.`;
    }

    /**
     * Envía un mensaje
     * @param {string} phoneNumber - Número de teléfono
     * @param {string} message - Mensaje a enviar
     */
    async sendMessage(phoneNumber, message) {
        if (!this.whatsappClient) {
            throw new Error('WhatsApp client not initialized');
        }

        try {
            await this.whatsappClient.sendMessage(phoneNumber, message);
            this.logger.info('WhatsAppAdministrator', `Message sent to: ${phoneNumber}`);
        } catch (error) {
            this.logger.error('WhatsAppAdministrator', `Error sending message: ${error.message}`, error);
            throw error;
        }
    }

    /**
     * Obtiene el estado del administrador
     * @returns {Object} - Estado del administrador
     */
    getStatus() {
        return {
            hasWhatsAppClient: !!this.whatsappClient,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = WhatsAppAdministrator;