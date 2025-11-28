/**
 * Formateador de mensajes para WhatsApp
 *
 * Responsabilidades:
 * - Transformar datos de dominio/aplicación a mensajes formateados de WhatsApp
 * - Aplicar formato visual (emojis, negritas, etc.)
 * - NO contiene lógica de negocio
 *
 * Esta es una clase de PRESENTACIÓN (capa de infraestructura)
 */
class WhatsAppMessageFormatter {
    /**
     * Formatea lista de precios activos
     * @param {Array} activePrices - Precios activos de BD
     * @returns {string} - Mensaje formateado
     */
    formatActivePrices(activePrices) {
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
            const typeLabel = this._getTypeOperationLabel(type);
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
     * Formatea tasas de Binance
     * @param {Array} rates - Tasas de Binance
     * @returns {string} - Mensaje formateado
     */
    formatBinanceRates(rates) {
        let response = '💱 *TASAS DE BINANCE (Tiempo Real)*\n\n';

        rates.forEach(rate => {
            response += `• ${rate.baseCode} → ${rate.quoteCode}: ${rate.rate.toFixed(5)}\n`;
            if (rate.revenue) {
                response += `  💰 Revenue: ${rate.revenue.toFixed(3)}%\n\n`;
            }
        });

        return response.trim();
    }

    /**
     * Formatea configuración de trading
     * @param {Array} tradingConfig - Configuración de trading
     * @returns {string} - Mensaje formateado
     */
    formatTradingConfig(tradingConfig) {
        let response = '⚙️ *CONFIGURACIÓN DE TRADING*\n\n';

        tradingConfig.forEach(config => {
            const baseCode = config.baseCurrency?.code_iso3 || 'N/A';
            const quoteCode = config.quoteCurrency?.code_iso3 || 'N/A';
            const revenue = parseFloat(config.porc_revenue || 0).toFixed(3);

            response += `• ${baseCode} → ${quoteCode}\n`;
            response += `  💰 Revenue: ${revenue}%\n\n`;
        });

        response += '📊 *Total de pares configurados:* ' + tradingConfig.length;

        return response.trim();
    }

    /**
     * Formatea mensaje de comandos disponibles
     * @returns {string} - Mensaje formateado
     */
    formatAvailableCommands() {
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
     * Formatea mensaje de ayuda
     * @returns {string} - Mensaje formateado
     */
    formatHelpMessage() {
        return `📖 *AYUDA - SISTEMA DE ADMINISTRACIÓN*

Este sistema permite gestionar el bot de WhatsApp mediante comandos.

*COMANDOS PRINCIPALES:*

🔹 *tasa_precio*
   Muestra las tasas de cambio activas del día o consulta Binance si no hay tasas configuradas.

🔹 *trading_config*
   Muestra la configuración de pares de trading activos con sus porcentajes de revenue.

🔹 *status*
   Muestra el estado actual del sistema, conexiones y servicios.

🔹 *clear_cache*
   Limpia la caché del sistema (requiere confirmación).

🔹 *system_info*
   Muestra información técnica del sistema (versión, uptime, memoria).

*NOTAS:*
- Los comandos son case-insensitive
- Escribe exactamente el nombre del comando
- Para más información, contacte al equipo técnico

🤖 Bot Walrex App v1.0`;
    }

    /**
     * Formatea mensaje de estado del sistema
     * @param {Object} status - Estado del sistema
     * @returns {string} - Mensaje formateado
     */
    formatSystemStatus(status) {
        return `📊 *ESTADO DEL SISTEMA*

🟢 Sistema operativo
⏱️ Uptime: ${status.uptime || 'N/A'}
💾 Memoria: ${status.memory || 'N/A'}
🔗 Conexiones activas: ${status.connections || 0}

✅ Todos los servicios funcionando correctamente`;
    }

    /**
     * Formatea mensaje de error genérico
     * @param {string} commandName - Nombre del comando que falló
     * @returns {string} - Mensaje formateado
     */
    formatErrorMessage(commandName) {
        return `❌ Error al procesar comando *${commandName}*

Intente nuevamente más tarde o contacte al equipo técnico.`;
    }

    /**
     * Formatea mensaje de confirmación
     * @param {string} message - Mensaje a confirmar
     * @returns {string} - Mensaje formateado
     */
    formatConfirmationMessage(message) {
        return `✅ ${message}`;
    }

    /**
     * Formatea mensaje de advertencia
     * @param {string} message - Mensaje de advertencia
     * @returns {string} - Mensaje formateado
     */
    formatWarningMessage(message) {
        return `⚠️ ${message}`;
    }

    /**
     * Obtiene la etiqueta descriptiva del tipo de operación
     * @private
     * @param {string} type - Tipo de operación
     * @returns {string} - Etiqueta descriptiva
     */
    _getTypeOperationLabel(type) {
        const labels = {
            '1': '💰 VENTA DE DIVISA (Fiat)',
            '2': '💸 COMPRA DE DIVISA (Fiat)',
            '3': '📤 ENVÍO DE REMESAS (Fiat)'
        };
        return labels[type] || `Tipo ${type}`;
    }
}

module.exports = WhatsAppMessageFormatter;