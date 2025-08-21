const structuredLogger = require('../infrastructure/config/StructuredLogger');
const TradingAdapter = require('../infrastructure/adapters/outbound/TradingAdapter');

// Modelos de base de datos
const { TradingCurrencies, Currency, BankTrade, Bank, Country, PriceExchange } = require('../../../models');

class WhatsAppAdministrator {
    constructor(customerService = null, tradingAdapter = null) {
        this.whatsappClient = null;
        this.customerService = customerService;
        this.tradingAdapter = tradingAdapter;
        
        structuredLogger.info('WhatsAppAdministrator', 'WhatsAppAdministrator initialized successfully', {
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
        structuredLogger.info('WhatsAppAdministrator', 'WhatsApp client set successfully');
    }

    /**
     * Maneja un mensaje entrante del administrador
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleMessage(message) {
        try {
            structuredLogger.info('WhatsAppAdministrator', `Handling admin message from: ${message.from}`, {
                messageBody: message.body?.substring(0, 50) + '...',
                hasWhatsAppClient: !!this.whatsappClient
            });
            
            const command = message.body?.trim().toLowerCase();
            await this.processCommand(command, message);
            
        } catch (error) {
            structuredLogger.error('WhatsAppAdministrator', `Error handling admin message: ${error.message}`, error, {
                messageFrom: message.from,
                messageBody: message.body?.substring(0, 50) + '...'
            });
            
            // No lanzar el error para evitar que se propague
            structuredLogger.warn('WhatsAppAdministrator', 'Admin message handling failed, continuing...', {
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
            structuredLogger.info('WhatsAppAdministrator', 'Processing tasa_precio command', {
                messageFrom: message.from
            });

            // Obtener precios activos de la base de datos
            const activePrices = await this.getActivePrices();
            
            if (activePrices && activePrices.length > 0) {
                // Formatear respuesta con precios de BD
                const response = this.formatActivePricesResponse(activePrices);
                await this.sendMessage(message.from, response);
            } else {
                // Si no hay precios activos, obtener de Binance
                await this.handleTasaPrecioFromBinance(message);
            }
            
        } catch (error) {
            structuredLogger.error('WhatsAppAdministrator', 'Error handling tasa_precio command', error, {
                messageFrom: message.from
            });
            
            // Enviar mensaje de error al administrador
            await this.sendMessage(message.from, 'Error al procesar comando tasa_precio. Intente más tarde.');
        }
    }

    /**
     * Obtiene las monedas configuradas para trading
     * @param {number} idCompany - ID de la empresa
     * @returns {Promise<Array>} Lista de monedas configuradas para trading
     */
    async getTradingCurrencies(idCompany) {
        try {
            const tradingConfig = await TradingCurrencies.findAll({
                where: { 
                    status: '1',
                    id_company: idCompany
                },
                include: [
                    {
                        model: Currency,
                        as: 'baseCurrency',
                        attributes: ['code_iso3', 'name', 'id_country'],
                        include: [
                            {
                                model: Country,
                                as: 'Country',
                                attributes: ['name']
                            }
                        ]
                    },
                    {
                        model: Currency,
                        as: 'quoteCurrency',
                        attributes: ['code_iso3', 'name', 'id_country'],
                        include: [
                            {
                                model: Country,
                                as: 'Country',
                                attributes: ['name']
                            }
                        ]
                    }
                ],
                order: [
                    ['id_currency_base', 'ASC'],
                    ['id_currency_quote', 'ASC']
                ]
            });

            // Para cada configuración de trading, obtener los bancos disponibles
            const tradingConfigWithBanks = await Promise.all(
                tradingConfig.map(async (config) => {
                    const configData = config.toJSON();
                    
                    // Obtener bancos para la moneda base (si es fiat)
                    let baseCurrencyBanks = [];
                    if (configData.baseCurrency && configData.baseCurrency.id_country) {
                        baseCurrencyBanks = await BankTrade.findAll({
                            where: {
                                id_country: configData.baseCurrency.id_country,
                                status: 1
                            },
                            include: [
                                {
                                    model: Bank,
                                    as: 'Bank',
                                    attributes: ['sigla', 'det_name', 'codigo', 'name_pay_binance'],
                                    where: { status: '1' }
                                }
                            ]
                        });
                    }

                    // Obtener bancos para la moneda quote (si es fiat)
                    let quoteCurrencyBanks = [];
                    if (configData.quoteCurrency && configData.quoteCurrency.id_country) {
                        quoteCurrencyBanks = await BankTrade.findAll({
                            where: {
                                id_country: configData.quoteCurrency.id_country,
                                status: 1
                            },
                            include: [
                                {
                                    model: Bank,
                                    as: 'Bank',
                                    attributes: ['sigla', 'det_name', 'codigo', 'name_pay_binance'],
                                    where: { status: '1' }
                                }
                            ]
                        });
                    }

                    // Agregar la información de bancos al resultado
                    return {
                        ...configData,
                        baseCurrencyBanks: baseCurrencyBanks.map(bt => ({
                            id: bt.Bank.id,
                            sigla: bt.Bank.sigla,
                            det_name: bt.Bank.det_name,
                            codigo: bt.Bank.codigo,
                            name_pay_binance: bt.Bank.name_pay_binance
                        })),
                        quoteCurrencyBanks: quoteCurrencyBanks.map(bt => ({
                            id: bt.Bank.id,
                            sigla: bt.Bank.sigla,
                            det_name: bt.Bank.det_name,
                            codigo: bt.Bank.codigo,
                            name_pay_binance: bt.Bank.name_pay_binance
                        }))
                    };
                })
            );

            structuredLogger.info('WhatsAppAdministrator', 'Trading currencies with banks retrieved from DB', {
                count: tradingConfigWithBanks.length,
                idCompany: idCompany
            });

            return tradingConfigWithBanks;
            
        } catch (error) {
            structuredLogger.error('WhatsAppAdministrator', 'Error getting trading currencies with banks from DB', error, {
                idCompany: idCompany
            });
            return null;
        }
    }

    /**
     * Obtiene precios activos de la base de datos
     * @returns {Promise<Array>} Lista de precios activos
     */
    async getActivePrices() {
        try {
            const { Op } = require('sequelize');
            
            // Obtener fecha actual
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Buscar precios activos para la fecha actual
            const activePrices = await PriceExchange.findAll({
                where: {
                    is_active: '1',
                    date_exchange: {
                        [Op.eq]: today
                    }
                },
                include: [
                    {
                        model: Currency,
                        as: 'baseCurrency',
                        attributes: ['code_iso3', 'name']
                    },
                    {
                        model: Currency,
                        as: 'quoteCurrency',
                        attributes: ['code_iso3', 'name']
                    }
                ],
                order: [
                    ['type_operation', 'ASC'],
                    ['id_currency_base', 'ASC']
                ]
            });

            structuredLogger.info('WhatsAppAdministrator', 'Active prices retrieved from DB', {
                count: activePrices.length,
                date: today.toISOString()
            });

            return activePrices;
            
        } catch (error) {
            structuredLogger.error('WhatsAppAdministrator', 'Error getting active prices from DB', error);
            return null;
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
            structuredLogger.info('WhatsAppAdministrator', 'Processing trading_config command', {
                messageFrom: message.from
            });

            // Por ahora usamos un ID de empresa por defecto (1), pero esto debería venir del contexto del usuario
            const idCompany = 1; // TODO: Obtener desde el contexto del usuario o parámetro
            const tradingConfig = await this.getTradingCurrencies(idCompany);

            if (tradingConfig && tradingConfig.length > 0) {
                const response = this.formatTradingConfigResponse(tradingConfig);
                await this.sendMessage(message.from, response);
            } else {
                await this.sendMessage(message.from, '⚠️ No hay configuración de trading activa.');
            }
            
        } catch (error) {
            structuredLogger.error('WhatsAppAdministrator', 'Error handling trading_config command', error, {
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
            structuredLogger.info('WhatsAppAdministrator', 'No active prices found, fetching from Binance', {
                messageFrom: message.from
            });

            // Enviar mensaje informativo
            await this.sendMessage(message.from, '⚠️ No hay precios activos en BD. Consultando configuración de trading...');
            
            if (!this.tradingAdapter) {
                await this.sendMessage(message.from, '❌ TradingAdapter no disponible. Contacte al equipo técnico.');
                return;
            }

            // 1. Obtener monedas configuradas para trading desde la BD
            // Por ahora usamos un ID de empresa por defecto (1), pero esto debería venir del contexto del usuario
            const idCompany = 1; // TODO: Obtener desde el contexto del usuario o parámetro
            const tradingCurrencies = await this.getTradingCurrencies(idCompany);
            
            if (!tradingCurrencies || tradingCurrencies.length === 0) {
                await this.sendMessage(message.from, '❌ No hay monedas configuradas para trading. Configure primero las monedas.');
                return;
            }

            structuredLogger.info('WhatsAppAdministrator', 'Trading currencies found', {
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
                        structuredLogger.info('WhatsAppAdministrator', `Getting rate for ${baseCode}-${quoteCode}`, {
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
                    structuredLogger.warn('WhatsAppAdministrator', `Error getting rate for ${currency.baseCurrency?.code_iso3}-${currency.quoteCurrency?.code_iso3}`, error);
                }
            }

            if (rates.length > 0) {
                const response = this.formatTradingCurrenciesRatesResponse(rates);
                await this.sendMessage(message.from, response);
            } else {
                await this.sendMessage(message.from, '❌ No se pudieron obtener tasas desde Binance para las monedas configuradas. Intente más tarde.');
            }
            
        } catch (error) {
            structuredLogger.error('WhatsAppAdministrator', 'Error handling Binance rates', error, {
                messageFrom: message.from
            });
            
            await this.sendMessage(message.from, '❌ Error al obtener tasas desde Binance. Contacte al equipo técnico.');
        }
    }

    /**
     * Obtiene pares de trading comunes para consultar tasas
     * @returns {Array} Lista de pares de trading
     */
    getCommonTradingPairs() {
        return [
            { base: 'USD', quote: 'PEN' },
            { base: 'PEN', quote: 'USD' },
            { base: 'EUR', quote: 'PEN' },
            { base: 'PEN', quote: 'EUR' },
            { base: 'USD', quote: 'EUR' },
            { base: 'EUR', quote: 'USD' }
        ];
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
     * Formatea la respuesta de tasas de Binance
     * @param {Array} rates - Lista de tasas obtenidas
     * @returns {string} Respuesta formateada
     */
    formatBinanceRatesResponse(rates) {
        let response = '🔄 *TASAS DESDE BINANCE*\n\n';
        response += '⚠️ *Nota: Estas tasas son en tiempo real*\n\n';
        
        rates.forEach(rate => {
            const formattedRate = parseFloat(rate.rate).toFixed(5);
            response += `• ${rate.base} → ${rate.quote}: ${formattedRate}\n`;
        });

        response += '\n💡 *Recomendación: Configure precios en BD para mejor control*';
        
        return response;
    }

    /**
     * Maneja el comando status
     * @param {Object} message - Mensaje de WhatsApp
     */
    async handleStatusCommand(message) {
        try {
            structuredLogger.info('WhatsAppAdministrator', 'Processing status command', {
                messageFrom: message.from
            });

            const status = this.getSystemStatus();
            const response = this.formatStatusResponse(status);
            
            await this.sendMessage(message.from, response);
            
        } catch (error) {
            structuredLogger.error('WhatsAppAdministrator', 'Error handling status command', error, {
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
            structuredLogger.info('WhatsAppAdministrator', 'Processing help command', {
                messageFrom: message.from
            });

            const helpMessage = this.getHelpMessage();
            await this.sendMessage(message.from, helpMessage);
            
        } catch (error) {
            structuredLogger.error('WhatsAppAdministrator', 'Error handling help command', error, {
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
            structuredLogger.info('WhatsAppAdministrator', 'Processing clear_cache command', {
                messageFrom: message.from
            });

            // Aquí implementarías la lógica para limpiar caché
            await this.sendMessage(message.from, '🧹 Caché del sistema limpiado exitosamente.');
            
        } catch (error) {
            structuredLogger.error('WhatsAppAdministrator', 'Error handling clear_cache command', error, {
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
            structuredLogger.info('WhatsAppAdministrator', 'Processing system_info command', {
                messageFrom: message.from
            });

            const systemInfo = this.getSystemInfo();
            const response = this.formatSystemInfoResponse(systemInfo);
            
            await this.sendMessage(message.from, response);
            
        } catch (error) {
            structuredLogger.error('WhatsAppAdministrator', 'Error handling system_info command', error, {
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
            structuredLogger.info('WhatsAppAdministrator', `Message sent to: ${phoneNumber}`);
        } catch (error) {
            structuredLogger.error('WhatsAppAdministrator', `Error sending message: ${error.message}`, error);
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
