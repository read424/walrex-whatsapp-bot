const structuredLogger = require('../../infrastructure/config/StructuredLogger');

class UXService {
    constructor(whatsappClient) {
        this.whatsappClient = whatsappClient;
        this.typingStates = new Map(); // Para rastrear estados de escritura por usuario
    }

    /**
     * Simula que el bot está escribiendo
     * @param {string} phoneNumber - Número de teléfono
     * @param {number} duration - Duración en milisegundos (opcional)
     */
    async startTyping(phoneNumber, duration = 2000) {
        try {
            if (!this.whatsappClient || !this.whatsappClient.client) {
                structuredLogger.warn('UXService', 'WhatsApp client not available for typing indicator');
                return;
            }

            // Normalizar número de teléfono
            const normalizedNumber = this.normalizePhoneNumber(phoneNumber);
            
            // Verificar si ya está escribiendo
            if (this.typingStates.has(normalizedNumber)) {
                structuredLogger.debug('UXService', 'Already typing for this user', { phoneNumber: normalizedNumber });
                return;
            }

            // Marcar como escribiendo
            this.typingStates.set(normalizedNumber, true);

            structuredLogger.info('UXService', 'Starting typing indicator', {
                phoneNumber: normalizedNumber,
                duration
            });

            // Iniciar indicador de escritura
            await this.whatsappClient.client.sendStateTyping(normalizedNumber);

            // Programar detener el indicador
            setTimeout(async () => {
                await this.stopTyping(normalizedNumber);
            }, duration);

        } catch (error) {
            structuredLogger.error('UXService', 'Error starting typing indicator', error, {
                phoneNumber
            });
            this.typingStates.delete(this.normalizePhoneNumber(phoneNumber));
        }
    }

    /**
     * Detiene el indicador de escritura
     * @param {string} phoneNumber - Número de teléfono
     */
    async stopTyping(phoneNumber) {
        try {
            const normalizedNumber = this.normalizePhoneNumber(phoneNumber);
            
            if (!this.typingStates.has(normalizedNumber)) {
                return; // Ya no está escribiendo
            }

            structuredLogger.info('UXService', 'Stopping typing indicator', {
                phoneNumber: normalizedNumber
            });

            // Detener indicador de escritura
            await this.whatsappClient.client.sendStateTyping(normalizedNumber, false);
            
            // Remover del estado
            this.typingStates.delete(normalizedNumber);

        } catch (error) {
            structuredLogger.error('UXService', 'Error stopping typing indicator', error, {
                phoneNumber
            });
            this.typingStates.delete(this.normalizePhoneNumber(phoneNumber));
        }
    }

    /**
     * Envía un mensaje con indicador de escritura
     * @param {string} phoneNumber - Número de teléfono
     * @param {string} message - Mensaje a enviar
     * @param {number} typingDuration - Duración del indicador de escritura
     */
    async sendMessageWithTyping(phoneNumber, message, typingDuration = 2000) {
        try {
            // Iniciar escritura
            await this.startTyping(phoneNumber, typingDuration);
            
            // Esperar un poco antes de enviar el mensaje
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Enviar mensaje
            await this.whatsappClient.sendMessage(phoneNumber, message);
            
            structuredLogger.info('UXService', 'Message sent with typing indicator', {
                phoneNumber,
                messageLength: message.length
            });

        } catch (error) {
            structuredLogger.error('UXService', 'Error sending message with typing', error, {
                phoneNumber,
                messageLength: message.length
            });
            throw error;
        }
    }

    /**
     * Simula procesamiento de menú con indicador de escritura
     * @param {string} phoneNumber - Número de teléfono
     * @param {Function} messageGenerator - Función que genera el mensaje
     * @param {number} processingTime - Tiempo de procesamiento simulado
     */
    async processMenuWithTyping(phoneNumber, messageGenerator, processingTime = 1500) {
        try {
            // Iniciar escritura
            await this.startTyping(phoneNumber, processingTime + 1000);
            
            // Simular procesamiento
            await new Promise(resolve => setTimeout(resolve, processingTime));
            
            // Generar y enviar mensaje
            const message = await messageGenerator();
            await this.whatsappClient.sendMessage(phoneNumber, message);
            
            structuredLogger.info('UXService', 'Menu processed with typing indicator', {
                phoneNumber,
                processingTime
            });

        } catch (error) {
            structuredLogger.error('UXService', 'Error processing menu with typing', error, {
                phoneNumber
            });
            throw error;
        }
    }

    /**
     * Normaliza el número de teléfono
     * @param {string} phoneNumber - Número de teléfono
     * @returns {string} - Número normalizado
     */
    normalizePhoneNumber(phoneNumber) {
        if (phoneNumber.includes('@c.us')) {
            return phoneNumber;
        }
        return phoneNumber + '@c.us';
    }

    /**
     * Obtiene el estado de escritura de un usuario
     * @param {string} phoneNumber - Número de teléfono
     * @returns {boolean} - True si está escribiendo
     */
    isTyping(phoneNumber) {
        const normalizedNumber = this.normalizePhoneNumber(phoneNumber);
        return this.typingStates.has(normalizedNumber);
    }

    /**
     * Limpia todos los estados de escritura
     */
    clearAllTypingStates() {
        this.typingStates.clear();
        structuredLogger.info('UXService', 'All typing states cleared');
    }
}

module.exports = UXService; 