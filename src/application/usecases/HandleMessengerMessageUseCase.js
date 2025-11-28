/**
 * Caso de uso de aplicación para manejar mensajes entrantes de Facebook Messenger
 * Orquesta la lógica entre el servicio de dominio y otros servicios necesarios
 * NO contiene lógica de negocio, solo orquestación
 */
class HandleMessengerMessageUseCase {
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
     * Ejecuta el caso de uso: procesar un mensaje entrante
     * @param {Object} params - Parámetros del mensaje
     * @param {string} params.senderPsid - PSID del remitente
     * @param {string} params.text - Texto del mensaje
     * @param {number} params.timestamp - Timestamp del mensaje
     * @returns {Promise<Object>} - Resultado de la operación
     */
    async execute({ senderPsid, text, timestamp }) {
        const startTime = Date.now();

        try {
            this.logger.info('HandleMessengerMessageUseCase', 'Iniciando procesamiento de mensaje', {
                senderPsid,
                hasText: !!text,
                timestamp
            });

            // Delegar al servicio de dominio
            await this.messengerService.processIncomingMessage(senderPsid, text);

            const duration = Date.now() - startTime;
            this.logger.performance('HandleMessengerMessageUseCase', 'execute', duration, {
                senderPsid
            });

            return {
                success: true,
                message: 'Mensaje procesado correctamente',
                data: {
                    senderPsid,
                    processedAt: new Date().toISOString(),
                    duration
                }
            };

        } catch (error) {
            this.logger.error('HandleMessengerMessageUseCase', 'Error procesando mensaje', error, {
                senderPsid,
                timestamp
            });

            return {
                success: false,
                message: 'Error procesando mensaje',
                error: {
                    code: 'MESSAGE_PROCESSING_ERROR',
                    details: error.message
                }
            };
        }
    }
}

module.exports = HandleMessengerMessageUseCase;