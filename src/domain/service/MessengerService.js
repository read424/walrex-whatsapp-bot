const { IllegalArgumentException } = require('../exceptions');

/**
 * Servicio de dominio para la lógica de negocio de Facebook Messenger
 * NO debe depender de la capa de aplicación ni infraestructura
 * Solo contiene lógica de negocio relacionada con mensajería
 */
class MessengerService {
    /**
     * @param {MessengerPort} messengerPort - Puerto de mensajería (abstracción)
     * @param {LoggerPort} logger - Puerto de logging
     */
    constructor(messengerPort, logger) {
        if (!messengerPort) {
            throw new Error('messengerPort is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.messengerPort = messengerPort;
        this.logger = logger;
    }

    /**
     * Procesar mensaje entrante de un usuario
     * @param {string} senderPsid - PSID del remitente
     * @param {string} messageText - Texto del mensaje
     * @returns {Promise<void>}
     */
    async processIncomingMessage(senderPsid, messageText) {
        this._validateSenderPsid(senderPsid);

        if (!messageText || typeof messageText !== 'string') {
            this.logger.warn('MessengerService', 'Mensaje sin texto recibido', { senderPsid });
            return;
        }

        this.logger.info('MessengerService', 'Procesando mensaje entrante', {
            senderPsid,
            messageLength: messageText.length
        });

        try {
            // Marcar como visto
            await this.messengerPort.markSeen(senderPsid);

            // Mostrar indicador de escritura
            await this.messengerPort.sendTypingOn(senderPsid);

            // Generar respuesta según el contenido del mensaje
            const response = this._generateResponse(messageText);

            // Enviar respuesta
            await this.messengerPort.sendMessage(senderPsid, response);

            this.logger.info('MessengerService', 'Mensaje procesado exitosamente', { senderPsid });

        } catch (error) {
            this.logger.error('MessengerService', 'Error procesando mensaje', error, { senderPsid });
            throw error;
        }
    }

    /**
     * Procesar postback (botón presionado)
     * @param {string} senderPsid - PSID del remitente
     * @param {string} payload - Payload del postback
     * @returns {Promise<void>}
     */
    async processPostback(senderPsid, payload) {
        this._validateSenderPsid(senderPsid);

        if (!payload || typeof payload !== 'string') {
            this.logger.warn('MessengerService', 'Postback sin payload recibido', { senderPsid });
            return;
        }

        this.logger.info('MessengerService', 'Procesando postback', { senderPsid, payload });

        try {
            const response = this._handlePostbackPayload(payload);
            await this.messengerPort.sendMessage(senderPsid, response);

        } catch (error) {
            this.logger.error('MessengerService', 'Error procesando postback', error, { senderPsid, payload });
            throw error;
        }
    }

    /**
     * Enviar mensaje con opciones de menú
     * @param {string} recipientPsid - PSID del destinatario
     * @returns {Promise<void>}
     */
    async sendMenuOptions(recipientPsid) {
        this._validateSenderPsid(recipientPsid);

        const buttons = [
            { title: 'Ver Tasas', payload: 'MENU_TASAS' },
            { title: 'Registrar Paquete', payload: 'MENU_PAQUETE' },
            { title: 'Ayuda', payload: 'MENU_AYUDA' }
        ];

        await this.messengerPort.sendButtonMessage(
            recipientPsid,
            '¿En qué puedo ayudarte?',
            buttons
        );
    }

    /**
     * Generar respuesta basada en el mensaje del usuario
     * Lógica de negocio de procesamiento de mensajes
     * @private
     * @param {string} messageText - Texto del mensaje
     * @returns {string} - Respuesta generada
     */
    _generateResponse(messageText) {
        const lowerText = messageText.toLowerCase().trim();

        // Comandos de saludo
        if (this._matchesPatterns(lowerText, ['hola', 'hi', 'hello', 'buenos días', 'buenas tardes', 'buenas noches'])) {
            return '¡Hola! 👋 Soy el asistente de Walrex. ¿En qué puedo ayudarte?\n\nPuedes preguntar por:\n- Tasas de cambio\n- Registrar un paquete\n- Ayuda';
        }

        // Comandos de tasa
        if (this._matchesPatterns(lowerText, ['tasa', 'dolar', 'precio', 'cambio', 'bcv'])) {
            return '💱 Para consultar las tasas de cambio actualizadas, visita nuestra plataforma web o escribe "tasas" para más información.';
        }

        // Comandos de paquete
        if (this._matchesPatterns(lowerText, ['paquete', 'envio', 'envío', 'registrar'])) {
            return '📦 Para registrar un paquete, necesito la siguiente información:\n- Número de tracking\n- País de origen\n- Descripción del contenido\n\n¿Tienes esta información lista?';
        }

        // Comandos de ayuda
        if (this._matchesPatterns(lowerText, ['ayuda', 'help', 'menu', 'menú', 'opciones'])) {
            return '🆘 Comandos disponibles:\n\n1. "Tasas" - Ver tasas de cambio\n2. "Paquete" - Registrar un envío\n3. "Contacto" - Hablar con un asesor\n\n¿En qué puedo ayudarte?';
        }

        // Comandos de contacto
        if (this._matchesPatterns(lowerText, ['asesor', 'humano', 'persona', 'contacto', 'agente'])) {
            return '👤 Un asesor se pondrá en contacto contigo pronto. Horario de atención: Lunes a Viernes 9am-6pm.';
        }

        // Respuesta por defecto
        return 'No entendí tu mensaje. Escribe "ayuda" para ver las opciones disponibles.';
    }

    /**
     * Manejar payload de postback
     * @private
     * @param {string} payload - Payload del postback
     * @returns {string} - Respuesta
     */
    _handlePostbackPayload(payload) {
        switch (payload) {
            case 'GET_STARTED':
                return '¡Bienvenido a Walrex! 🎉\n\nSoy tu asistente virtual. Puedo ayudarte con:\n- Consultar tasas de cambio\n- Registrar paquetes\n- Información general\n\n¿En qué puedo ayudarte?';

            case 'MENU_TASAS':
                return '💱 Las tasas de cambio se actualizan diariamente según el BCV.\n\nPara información actualizada, visita nuestra plataforma web.';

            case 'MENU_PAQUETE':
                return '📦 Para registrar un paquete, envíame:\n1. Número de tracking\n2. País de origen\n3. Descripción del contenido';

            case 'MENU_AYUDA':
                return '🆘 Estoy aquí para ayudarte.\n\nEscribe tu consulta o selecciona una opción del menú.';

            default:
                return 'Opción no reconocida. Escribe "ayuda" para ver las opciones disponibles.';
        }
    }

    /**
     * Verificar si el texto coincide con algún patrón
     * @private
     * @param {string} text - Texto a verificar
     * @param {Array<string>} patterns - Patrones a buscar
     * @returns {boolean}
     */
    _matchesPatterns(text, patterns) {
        return patterns.some(pattern => text.includes(pattern));
    }

    /**
     * Validar PSID del remitente
     * @private
     * @param {string} senderPsid - PSID a validar
     */
    _validateSenderPsid(senderPsid) {
        if (!senderPsid || typeof senderPsid !== 'string' || senderPsid.trim().length === 0) {
            throw new IllegalArgumentException('El senderPsid es requerido y debe ser válido');
        }
    }
}

module.exports = MessengerService;