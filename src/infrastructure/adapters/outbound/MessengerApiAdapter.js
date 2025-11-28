const MessengerPort = require('../../../application/ports/output/MessengerPort');
const axios = require('axios');

/**
 * Adaptador que implementa MessengerPort usando la API de Facebook Messenger
 * Este es un detalle de infraestructura que NO debe ser conocido por el dominio
 */
class MessengerApiAdapter extends MessengerPort {
    /**
     * @param {LoggerPort} logger - Puerto de logging
     */
    constructor(logger) {
        super();

        if (!logger) {
            throw new Error('logger is required');
        }

        this.logger = logger;
        this.pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
        this.apiVersion = process.env.FACEBOOK_API_VERSION || 'v21.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;

        if (!this.pageAccessToken) {
            throw new Error('FACEBOOK_PAGE_ACCESS_TOKEN no está configurado en las variables de entorno');
        }

        this.logger.info('MessengerApiAdapter', 'Inicializado correctamente', {
            apiVersion: this.apiVersion,
            hasToken: !!this.pageAccessToken
        });
    }

    /**
     * Enviar mensaje de texto
     * @param {string} recipientPsid - PSID del destinatario
     * @param {string} text - Texto del mensaje
     * @returns {Promise<Object>} - Respuesta de la API
     */
    async sendMessage(recipientPsid, text) {
        try {
            const url = `${this.baseUrl}/me/messages`;

            const requestBody = {
                recipient: { id: recipientPsid },
                message: { text: text },
                messaging_type: 'RESPONSE'
            };

            const response = await axios.post(url, requestBody, {
                params: { access_token: this.pageAccessToken }
            });

            this.logger.info('MessengerApiAdapter', 'Mensaje enviado correctamente', {
                recipientPsid,
                messageId: response.data.message_id
            });

            return response.data;

        } catch (error) {
            this.logger.error('MessengerApiAdapter', 'Error enviando mensaje', error, {
                recipientPsid,
                errorData: error.response?.data
            });
            throw new Error(`Error enviando mensaje: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Enviar mensaje con botones
     * @param {string} recipientPsid - PSID del destinatario
     * @param {string} text - Texto del mensaje
     * @param {Array<Object>} buttons - Array de botones {title, payload}
     * @returns {Promise<Object>} - Respuesta de la API
     */
    async sendButtonMessage(recipientPsid, text, buttons) {
        try {
            const url = `${this.baseUrl}/me/messages`;

            const requestBody = {
                recipient: { id: recipientPsid },
                message: {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'button',
                            text: text,
                            buttons: buttons.map(btn => ({
                                type: 'postback',
                                title: btn.title,
                                payload: btn.payload
                            }))
                        }
                    }
                }
            };

            const response = await axios.post(url, requestBody, {
                params: { access_token: this.pageAccessToken }
            });

            this.logger.info('MessengerApiAdapter', 'Mensaje con botones enviado correctamente', {
                recipientPsid,
                buttonsCount: buttons.length
            });

            return response.data;

        } catch (error) {
            this.logger.error('MessengerApiAdapter', 'Error enviando mensaje con botones', error, {
                recipientPsid,
                errorData: error.response?.data
            });
            throw new Error(`Error enviando mensaje con botones: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Enviar imagen
     * @param {string} recipientPsid - PSID del destinatario
     * @param {string} imageUrl - URL de la imagen
     * @returns {Promise<Object>} - Respuesta de la API
     */
    async sendImage(recipientPsid, imageUrl) {
        try {
            const url = `${this.baseUrl}/me/messages`;

            const requestBody = {
                recipient: { id: recipientPsid },
                message: {
                    attachment: {
                        type: 'image',
                        payload: { url: imageUrl }
                    }
                }
            };

            const response = await axios.post(url, requestBody, {
                params: { access_token: this.pageAccessToken }
            });

            this.logger.info('MessengerApiAdapter', 'Imagen enviada correctamente', {
                recipientPsid,
                imageUrl
            });

            return response.data;

        } catch (error) {
            this.logger.error('MessengerApiAdapter', 'Error enviando imagen', error, {
                recipientPsid,
                imageUrl,
                errorData: error.response?.data
            });
            throw new Error(`Error enviando imagen: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Marcar mensaje como visto
     * @param {string} recipientPsid - PSID del destinatario
     * @returns {Promise<void>}
     */
    async markSeen(recipientPsid) {
        try {
            const url = `${this.baseUrl}/me/messages`;

            const requestBody = {
                recipient: { id: recipientPsid },
                sender_action: 'mark_seen'
            };

            await axios.post(url, requestBody, {
                params: { access_token: this.pageAccessToken }
            });

            this.logger.debug('MessengerApiAdapter', 'Mensaje marcado como visto', { recipientPsid });

        } catch (error) {
            // No es crítico si falla
            this.logger.warn('MessengerApiAdapter', 'Error marcando como visto', {
                recipientPsid,
                error: error.message
            });
        }
    }

    /**
     * Mostrar indicador de escritura
     * @param {string} recipientPsid - PSID del destinatario
     * @returns {Promise<void>}
     */
    async sendTypingOn(recipientPsid) {
        try {
            const url = `${this.baseUrl}/me/messages`;

            const requestBody = {
                recipient: { id: recipientPsid },
                sender_action: 'typing_on'
            };

            await axios.post(url, requestBody, {
                params: { access_token: this.pageAccessToken }
            });

            this.logger.debug('MessengerApiAdapter', 'Indicador de escritura activado', { recipientPsid });

        } catch (error) {
            // No es crítico si falla
            this.logger.warn('MessengerApiAdapter', 'Error activando typing', {
                recipientPsid,
                error: error.message
            });
        }
    }

    /**
     * Apagar indicador de escritura
     * @param {string} recipientPsid - PSID del destinatario
     * @returns {Promise<void>}
     */
    async sendTypingOff(recipientPsid) {
        try {
            const url = `${this.baseUrl}/me/messages`;

            const requestBody = {
                recipient: { id: recipientPsid },
                sender_action: 'typing_off'
            };

            await axios.post(url, requestBody, {
                params: { access_token: this.pageAccessToken }
            });

            this.logger.debug('MessengerApiAdapter', 'Indicador de escritura desactivado', { recipientPsid });

        } catch (error) {
            // No es crítico si falla
            this.logger.warn('MessengerApiAdapter', 'Error desactivando typing', {
                recipientPsid,
                error: error.message
            });
        }
    }
}

module.exports = MessengerApiAdapter;
