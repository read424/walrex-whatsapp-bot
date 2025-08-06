const structuredLogger = require('../../infrastructure/config/StructuredLogger');
const { SESSION_STAGES } = require('../../domain/constants/WhatsAppConstants');
const { isOfLegalAge, isValidEmail, getCountryCode, normalizePhoneNumber } = require('../../utils/index');
const moment = require('moment');

class RegistrationProcessor {
    constructor(customerService, addChatMessageUseCase, addChatSessionUseCase) {
        // Logger ya no necesario, usando structuredLogger directamente
        this.customerService = customerService;
        this.addChatMessageUseCase = addChatMessageUseCase;
        this.addChatSessionUseCase = addChatSessionUseCase;
    }

    /**
     * Procesa el proceso de registro paso a paso
     * @param {Object} session - Sesión del usuario
     * @param {string} message - Mensaje del usuario
     * @param {string} prompt - Prompt opcional para mostrar
     */
    async handleRegistrationProcess(session, message, prompt) {
        structuredLogger.info('RegistrationProcessor', `Processing registration for stage: ${session.stage}`);
        
        switch(session.stage) {
            case SESSION_STAGES.INITIAL:
                await this.collectData(session, undefined, message, prompt || '✍️ ingresa tus Apellidos.');
                break;
            case SESSION_STAGES.COLLECTING_LAST_NAME:
                await this.collectData(session, 'firstLastName', message, prompt || '✍️ ingresa tus Nombres.');
                break;
            case SESSION_STAGES.COLLECTING_FIRST_NAME:
                await this.collectData(session, 'Names', message, prompt || '🗓️ ingresa tu Fecha de Nacimiento (DD/MM/AAAA).');
                break;
            case SESSION_STAGES.COLLECTING_DOB:
                await this.collectData(session, 'DateBirth', message, prompt || '✉️ ingresa tu Email.');
                break;
            case SESSION_STAGES.COLLECTING_EMAIL:
                await this.collectData(session, 'Email', message);
                break;
            case SESSION_STAGES.COMPLETED:
                structuredLogger.info('RegistrationProcessor', `Registration completed for session: ${session.phoneNumber}`);
                break;
            default:
                structuredLogger.warn('RegistrationProcessor', `Unknown stage: ${session.stage}`);
                break;
        }
    }

    /**
     * Valida y procesa los datos de entrada según la etapa
     * @param {Object} session - Sesión del usuario
     * @param {string} field - Campo a validar
     * @param {string} value - Valor del campo
     * @param {string} nextPrompt - Siguiente prompt a mostrar
     */
    async collectData(session, field, value, nextPrompt) {
        if (field !== undefined) {
            session.saveData(field, value);
        }

        if (session.stage !== SESSION_STAGES.COMPLETED) {
            await this.addChatMessageUseCase.addChatMessageResponse(
                session.phoneNumber, 
                nextPrompt, 
                session.session_id, 
                undefined
            );
            await this.addChatSessionUseCase.updateChatSessionResponse(session.session_id);
            
            // Enviar mensaje al usuario
            if (this.whatsappClient) {
                await this.whatsappClient.sendMessage(session.phoneNumber, nextPrompt);
            }
        } else {
            await this.completeRegistration(session);
        }
    }

    /**
     * Completa el proceso de registro
     * @param {Object} session - Sesión del usuario
     */
    async completeRegistration(session) {
        try {
            // Generar código de referido
            session.data.referralCode = this.generateReferralCode();
            session.data.id_country_phone = getCountryCode(session.phoneNumber);
            session.data.DateBirth = moment(session.data.DateBirth, 'DD/MM/YYYY', true).format('YYYY-MM-DD');
            session.data['Phone'] = normalizePhoneNumber(session.phoneNumber);

            // Crear cliente y usuario
            const savedCustomer = await this.customerService.create(session.data, session.data.referralCode);
            
            if (savedCustomer) {
                const mensajeReferido = `He sido referido por ${session.data.referralCode}.`;
                const linkReferido = `https://wa.me/51914301824/?text=${encodeURIComponent(mensajeReferido)}`;
                
                if (this.whatsappClient) {
                    await this.whatsappClient.sendMessage(
                        session.phoneNumber, 
                        `Comparte tu enlace de referido con tus amigos y gana 5$. ${linkReferido}`
                    );
                }
                
                structuredLogger.info('RegistrationProcessor', `Registration completed successfully for: ${session.phoneNumber}`);
            }
        } catch (error) {
            structuredLogger.error('RegistrationProcessor', `Error completing registration: ${error.message}`);
            throw error;
        }
    }

    /**
     * Valida la fecha de nacimiento
     * @param {string} dateOfBirth - Fecha de nacimiento en formato DD/MM/YYYY
     * @returns {boolean} - True si es válida y mayor de edad
     */
    validateDateOfBirth(dateOfBirth) {
        return isOfLegalAge(dateOfBirth);
    }

    /**
     * Valida el email
     * @param {string} email - Email a validar
     * @returns {Promise<boolean>} - True si es válido y no existe
     */
    async validateEmail(email) {
        if (!isValidEmail(email)) {
            return false;
        }
        
        const emailExists = await this.customerService.existsEmailUser(email);
        return !emailExists;
    }

    /**
     * Genera un código de referido único
     * @returns {string} - Código de referido
     */
    generateReferralCode() {
        const { UUIDUtil } = require('../../utils/index');
        return UUIDUtil.generateReferralCode();
    }

    /**
     * Establece el cliente de WhatsApp para enviar mensajes
     * @param {Object} whatsappClient - Cliente de WhatsApp
     */
    setWhatsAppClient(whatsappClient) {
        this.whatsappClient = whatsappClient;
    }
}

module.exports = RegistrationProcessor; 