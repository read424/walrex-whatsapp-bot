const structuredLogger = require('../../infrastructure/config/StructuredLogger');
const { normalizePhoneNumber } = require('../../utils/index');

class ReferralManager {
    constructor(customerService, addChatMessageUseCase, addChatSessionUseCase) {
        // Logger ya no necesario, usando structuredLogger directamente
        this.customerService = customerService;
        this.addChatMessageUseCase = addChatMessageUseCase;
        this.addChatSessionUseCase = addChatSessionUseCase;
    }

    /**
     * Procesa una solicitud de referido
     * @param {string} phoneNumber - Número de teléfono
     * @param {string} sessionId - ID de la sesión
     * @param {string} messageId - ID del mensaje
     * @param {string} userIdReferral - ID del usuario referido (opcional)
     */
    async processReferralRequest(phoneNumber, sessionId, messageId, userIdReferral = null) {
        structuredLogger.info('ReferralManager', `Processing referral request for: ${phoneNumber}`);
        
        try {
            const dataCustomer = await this.getInfoCustomer(phoneNumber);
            const normalizedPhone = normalizePhoneNumber(phoneNumber);
            
            if (!dataCustomer) {
                // Usuario no existe, iniciar proceso de registro
                await this.initiateRegistration(normalizedPhone, sessionId, messageId, userIdReferral);
            } else {
                // Usuario existe, enviar enlace de referido
                await this.sendReferralLink(normalizedPhone, dataCustomer);
            }
        } catch (error) {
            structuredLogger.error('ReferralManager', `Error processing referral request: ${error.message}`, error);
            throw error;
        }
    }

    /**
     * Procesa cuando alguien es referido por otro usuario
     * @param {string} phoneNumber - Número de teléfono
     * @param {string} message - Mensaje completo
     * @param {string} sessionId - ID de la sesión
     * @param {string} messageId - ID del mensaje
     */
    async processReferredBy(phoneNumber, message, sessionId, messageId) {
        structuredLogger.info('ReferralManager', `Processing referred by for: ${phoneNumber}`);
        
        try {
            const codeRefer = message.trim().toLowerCase().replace('he sido referido por', '');
            const codigoReferido = codeRefer.trim().toUpperCase();
            
            const dataCustomer = await this.customerService.searchUserByReferralCode(codigoReferido);
            const existCode = this.checkReferralCode(dataCustomer);
            
            if (existCode) {
                await this.processReferralRequest(phoneNumber, sessionId, messageId, dataCustomer.id);
            } else {
                await this.processReferralRequest(phoneNumber, sessionId, messageId, null);
            }
        } catch (error) {
            structuredLogger.error('ReferralManager', `Error processing referred by: ${error.message}`, error);
            throw error;
        }
    }

    /**
     * Obtiene información del cliente por número de teléfono
     * @param {string} phoneNumber - Número de teléfono
     * @returns {Object} - Información del cliente
     */
    async getInfoCustomer(phoneNumber) {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        return await this.customerService.findByPhoneNumber(normalizedPhone);
    }

    /**
     * Inicia el proceso de registro para un nuevo usuario
     * @param {string} phoneNumber - Número de teléfono normalizado
     * @param {string} sessionId - ID de la sesión
     * @param {string} messageId - ID del mensaje
     * @param {string} userIdReferral - ID del usuario referido
     */
    async initiateRegistration(phoneNumber, sessionId, messageId, userIdReferral) {
        structuredLogger.info('ReferralManager', `Initiating registration for: ${phoneNumber}`);
        
        // Aquí se debería crear una sesión y iniciar el proceso de registro
        // Esta lógica se manejará en el RegistrationProcessor
        if (this.onRegistrationInitiated) {
            await this.onRegistrationInitiated(phoneNumber, sessionId, messageId, userIdReferral);
        }
    }

    /**
     * Envía el enlace de referido a un usuario existente
     * @param {string} phoneNumber - Número de teléfono normalizado
     * @param {Object} customerData - Datos del cliente
     */
    async sendReferralLink(phoneNumber, customerData) {
        structuredLogger.info('ReferralManager', `Sending referral link to: ${phoneNumber}`);
        
        try {
            const mensajeReferido = `He sido referido por ${customerData.code_referral}.`;
            const linkReferido = `https://wa.me/51914301824/?text=${encodeURIComponent(mensajeReferido)}`;
            
            const responseMessage = `🎯 Tu enlace de referido es: ${linkReferido}\n\nComparte este enlace con tus amigos y gana 5$ por cada referido.`;
            
            if (this.whatsappClient) {
                await this.whatsappClient.sendMessage(phoneNumber, responseMessage);
            }
        } catch (error) {
            structuredLogger.error('ReferralManager', `Error sending referral link: ${error.message}`, error);
            throw error;
        }
    }

    /**
     * Verifica si un código de referido es válido
     * @param {Object} data - Datos del usuario referido
     * @returns {boolean} - True si el código es válido
     */
    checkReferralCode(data) {
        return data !== null;
    }

    /**
     * Establece el cliente de WhatsApp para enviar mensajes
     * @param {Object} whatsappClient - Cliente de WhatsApp
     */
    setWhatsAppClient(whatsappClient) {
        this.whatsappClient = whatsappClient;
    }

    /**
     * Establece el callback para cuando se inicia el registro
     * @param {Function} callback - Función callback
     */
    setRegistrationInitiatedCallback(callback) {
        this.onRegistrationInitiated = callback;
    }
}

module.exports = ReferralManager; 