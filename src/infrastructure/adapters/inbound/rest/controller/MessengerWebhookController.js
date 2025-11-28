/**
 * Controlador REST para el webhook de Facebook Messenger
 *
 * Responsabilidad:
 * - Recibir requests HTTP del webhook de Facebook
 * - Validar firma de seguridad (verificación del webhook)
 * - Extraer y validar eventos del webhook
 * - Delegar procesamiento a casos de uso
 * - Responder rápidamente a Facebook (requisito de la API)
 *
 * Este controlador NO contiene lógica de negocio, solo orquestación HTTP
 */
class MessengerWebhookController {
    /**
     * Constructor con inyección de dependencias
     * @param {Object} dependencies - Dependencias del controlador
     * @param {Object} dependencies.handleMessengerMessageUseCase - Caso de uso para mensajes
     * @param {Object} dependencies.handleMessengerPostbackUseCase - Caso de uso para postbacks
     * @param {Object} dependencies.logger - Adaptador de logging
     */
    constructor({ handleMessengerMessageUseCase, handleMessengerPostbackUseCase, logger }) {
        // Validar dependencias requeridas
        if (!handleMessengerMessageUseCase) {
            throw new Error('handleMessengerMessageUseCase is required');
        }
        if (!handleMessengerPostbackUseCase) {
            throw new Error('handleMessengerPostbackUseCase is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.handleMessengerMessageUseCase = handleMessengerMessageUseCase;
        this.handleMessengerPostbackUseCase = handleMessengerPostbackUseCase;
        this.logger = logger;

        // Token de verificación del webhook (configurado en Meta for Developers)
        this.verifyToken = process.env.META_VERIFY_TOKEN;

        if (!this.verifyToken) {
            this.logger.warn('MessengerWebhookController', 'META_VERIFY_TOKEN no configurado - la verificación del webhook fallará');
        }
    }

    /**
     * GET /webhook/messenger
     * Verificación del webhook por Facebook (se ejecuta una sola vez al configurar)
     *
     * Facebook envía:
     * - hub.mode=subscribe
     * - hub.verify_token=<tu_token>
     * - hub.challenge=<random_string>
     *
     * Debes responder con el hub.challenge si el token es correcto
     */
    verifyWebhook(req, res) {
        try {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            this.logger.info('MessengerWebhookController', 'Solicitud de verificación del webhook', {
                mode,
                hasToken: !!token,
                hasChallenge: !!challenge,
                ip: req.ip
            });

            // Verificar que sea modo suscripción y el token coincida
            if (mode === 'subscribe' && token === this.verifyToken) {
                this.logger.info('MessengerWebhookController', 'Webhook verificado correctamente');

                // Responder con el challenge para completar la verificación
                return res.status(200).send(challenge);
            } else {
                this.logger.error('MessengerWebhookController', 'Token de verificación incorrecto', null, {
                    expectedToken: this.verifyToken,
                    receivedToken: token,
                    mode
                });

                return res.sendStatus(403);
            }

        } catch (error) {
            this.logger.error('MessengerWebhookController', 'Error en verificación del webhook', error);
            return res.sendStatus(500);
        }
    }

    /**
     * POST /webhook/messenger
     * Recibir eventos del webhook (llamado por Facebook cuando hay actividad)
     *
     * IMPORTANTE: Debes responder 200 rápidamente (< 20 segundos) o Facebook reintentará
     */
    async receiveWebhook(req, res) {
        const startTime = Date.now();

        try {
            const body = req.body;

            // Logging de evento recibido
            this.logger.info('MessengerWebhookController', 'Webhook event recibido', {
                object: body.object,
                entriesCount: body.entry?.length || 0
            });

            // Verificar que sea de una página
            if (body.object !== 'page') {
                this.logger.warn('MessengerWebhookController', 'Evento no es de tipo page', {
                    object: body.object
                });
                return res.sendStatus(404);
            }

            // ⚠️ IMPORTANTE: Responder 200 inmediatamente a Facebook
            // El procesamiento se hace de forma asíncrona
            res.sendStatus(200);

            // Procesar eventos de forma asíncrona (sin bloquear la respuesta)
            this.processWebhookEvents(body.entry, startTime).catch(error => {
                this.logger.error('MessengerWebhookController', 'Error procesando eventos asíncronamente', error);
            });

        } catch (error) {
            this.logger.error('MessengerWebhookController', 'Error procesando webhook', error);

            // Si aún no se ha enviado respuesta, responder con error
            if (!res.headersSent) {
                return res.sendStatus(500);
            }
        }
    }

    /**
     * Procesa los eventos del webhook de forma asíncrona
     * @private
     * @param {Array} entries - Array de entries del webhook
     * @param {number} startTime - Timestamp de inicio para métricas
     */
    async processWebhookEvents(entries, startTime) {
        try {
            for (const entry of entries) {
                // Cada entry puede contener múltiples eventos de messaging
                const messagingEvents = entry.messaging || [];

                for (const event of messagingEvents) {
                    await this.handleMessagingEvent(event);
                }
            }

            // Log de performance
            const duration = Date.now() - startTime;
            this.logger.performance('MessengerWebhookController', 'processWebhookEvents', duration, {
                entriesCount: entries.length
            });

        } catch (error) {
            this.logger.error('MessengerWebhookController', 'Error en processWebhookEvents', error);
        }
    }

    /**
     * Maneja un evento individual de messaging
     * @private
     * @param {Object} event - Evento de messaging
     */
    async handleMessagingEvent(event) {
        try {
            const senderPsid = event.sender?.id;

            if (!senderPsid) {
                this.logger.warn('MessengerWebhookController', 'Evento sin sender PSID', { event });
                return;
            }

            // Determinar tipo de evento y delegar al caso de uso apropiado
            if (event.message) {
                await this.handleMessage(senderPsid, event.message);
            } else if (event.postback) {
                await this.handlePostback(senderPsid, event.postback);
            } else if (event.delivery) {
                this.logger.debug('MessengerWebhookController', 'Evento de delivery recibido', { senderPsid });
            } else if (event.read) {
                this.logger.debug('MessengerWebhookController', 'Evento de read recibido', { senderPsid });
            } else {
                this.logger.warn('MessengerWebhookController', 'Tipo de evento no reconocido', { event });
            }

        } catch (error) {
            this.logger.error('MessengerWebhookController', 'Error manejando evento', error, { event });
        }
    }

    /**
     * Maneja un mensaje recibido
     * @private
     * @param {string} senderPsid - PSID del remitente
     * @param {Object} message - Objeto mensaje
     */
    async handleMessage(senderPsid, message) {
        try {
            // Validar que tenga texto (ignorar stickers, imágenes, etc. por ahora)
            if (!message.text) {
                this.logger.debug('MessengerWebhookController', 'Mensaje sin texto recibido', {
                    senderPsid,
                    hasAttachments: !!message.attachments,
                    hasSticker: !!message.sticker_id
                });
                return;
            }

            this.logger.info('MessengerWebhookController', 'Procesando mensaje de texto', {
                senderPsid,
                messageLength: message.text.length,
                mid: message.mid
            });

            // Delegar al caso de uso
            const result = await this.handleMessengerMessageUseCase.execute({
                senderPsid,
                text: message.text,
                timestamp: Date.now()
            });

            if (!result.success) {
                this.logger.error('MessengerWebhookController', 'Caso de uso retornó error', null, result);
            }

        } catch (error) {
            this.logger.error('MessengerWebhookController', 'Error manejando mensaje', error, {
                senderPsid
            });
        }
    }

    /**
     * Maneja un postback (botón presionado)
     * @private
     * @param {string} senderPsid - PSID del remitente
     * @param {Object} postback - Objeto postback
     */
    async handlePostback(senderPsid, postback) {
        try {
            const payload = postback.payload;
            const title = postback.title;

            this.logger.info('MessengerWebhookController', 'Procesando postback', {
                senderPsid,
                payload,
                title
            });

            // Delegar al caso de uso
            const result = await this.handleMessengerPostbackUseCase.execute({
                senderPsid,
                payload,
                title
            });

            if (!result.success) {
                this.logger.error('MessengerWebhookController', 'Caso de uso de postback retornó error', null, result);
            }

        } catch (error) {
            this.logger.error('MessengerWebhookController', 'Error manejando postback', error, {
                senderPsid,
                payload: postback?.payload
            });
        }
    }
}

module.exports = MessengerWebhookController;