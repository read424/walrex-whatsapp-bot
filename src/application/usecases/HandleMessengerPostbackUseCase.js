/**
 * Caso de uso de aplicación para manejar postbacks (botones presionados) de Facebook Messenger
 * Orquesta la lógica entre el servicio de dominio y otros servicios necesarios
 */
class HandleMessengerPostbackUseCase {
    /**
     * @param {MessengerService} messengerService - Servicio de dominio de Messenger
     * @param {LoggerPort} logger - Puerto de logging
     */
    constructor(messengerService, logger) {
        if (!messengerService) {
            throw new Error('messengerService is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.messengerService = messengerService;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso: procesar un postback
     * @param {Object} params - Parámetros del postback
     * @param {string} params.senderPsid - PSID del remitente
     * @param {string} params.payload - Payload del postback
     * @param {string} params.title - Título del botón presionado
     * @returns {Promise<Object>} - Resultado de la operación
     */
    async execute({ senderPsid, payload, title }) {
        const startTime = Date.now();

        try {
            this.logger.info('HandleMessengerPostbackUseCase', 'Iniciando procesamiento de postback', {
                senderPsid,
                payload,
                title
            });

            // Delegar al servicio de dominio
            await this.messengerService.processPostback(senderPsid, payload);

            const duration = Date.now() - startTime;
            this.logger.performance('HandleMessengerPostbackUseCase', 'execute', duration, {
                senderPsid,
                payload
            });

            return {
                success: true,
                message: 'Postback procesado correctamente',
                data: {
                    senderPsid,
                    payload,
                    processedAt: new Date().toISOString(),
                    duration
                }
            };

        } catch (error) {
            this.logger.error('HandleMessengerPostbackUseCase', 'Error procesando postback', error, {
                senderPsid,
                payload
            });

            return {
                success: false,
                message: 'Error procesando postback',
                error: {
                    code: 'POSTBACK_PROCESSING_ERROR',
                    details: error.message
                }
            };
        }
    }
}

module.exports = HandleMessengerPostbackUseCase;