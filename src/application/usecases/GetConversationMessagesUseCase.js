const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Obtener mensajes de una conversación con paginación completa
 *
 * Responsabilidad:
 * - Orquestar la obtención de mensajes de una conversación
 * - Validar parámetros de paginación (page y limit)
 * - Calcular si hay más mensajes disponibles (hasMore)
 * - Retornar respuesta en formato estandarizado para el frontend
 *
 * Dependencias inyectadas:
 * - chatMessageRepository: Para obtener mensajes con conteo
 * - conversationRepository: Para validar que la conversación existe
 * - logger: Para registrar operaciones y errores
 */
class GetConversationMessagesUseCase {
    constructor(chatMessageRepository, conversationRepository, logger) {
        if (!chatMessageRepository) {
            throw new Error('chatMessageRepository is required');
        }
        if (!conversationRepository) {
            throw new Error('conversationRepository is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.chatMessageRepository = chatMessageRepository;
        this.conversationRepository = conversationRepository;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso de obtención de mensajes de conversación
     *
     * @param {Object} params - Parámetros del caso de uso
     * @param {number} params.conversationId - ID de la conversación
     * @param {number} [params.page=1] - Número de página (1-indexed)
     * @param {number} [params.limit=50] - Límite de resultados por página
     * @param {number} [params.tenantId] - ID del tenant (opcional para validación)
     * @returns {Promise<Object>} - Resultado con formato MessageListResponse
     * @throws {IllegalArgumentException} - Si los parámetros son inválidos
     */
    async execute({ conversationId, page = 1, limit = 50, tenantId = null }) {
        this.logger.info('GetConversationMessagesUseCase', 'Getting conversation messages', {
            conversationId,
            page,
            limit,
            tenantId
        });

        // 1. Validar conversationId
        this.validateConversationId(conversationId);

        // 2. Validar y normalizar parámetros de paginación
        const normalizedPage = this.validateAndNormalizePage(page);
        const normalizedLimit = this.validateAndNormalizeLimit(limit);

        // 3. Validar que la conversación existe (si se proporciona tenantId)
        if (tenantId) {
            await this.validateConversationExists(conversationId, tenantId);
        }

        // 4. Obtener mensajes con conteo total del repositorio
        const { messages, total } = await this.chatMessageRepository.findBySessionWithCount(
            conversationId,
            normalizedPage,
            normalizedLimit
        );

        // 5. Calcular si hay más mensajes
        const hasMore = this.calculateHasMore(normalizedPage, normalizedLimit, total);

        // 6. Mapear mensajes al formato del frontend
        const formattedMessages = messages.map(message => this.mapToFrontendFormat(message));

        this.logger.info('GetConversationMessagesUseCase', 'Messages retrieved successfully', {
            conversationId,
            page: normalizedPage,
            limit: normalizedLimit,
            total,
            returned: formattedMessages.length,
            hasMore
        });

        // 7. Retornar en formato MessageListResponse
        return {
            messages: formattedMessages,
            total,
            page: normalizedPage,
            limit: normalizedLimit,
            hasMore
        };
    }

    /**
     * Valida el conversationId
     * @private
     */
    validateConversationId(conversationId) {
        if (!conversationId) {
            throw new IllegalArgumentException('conversationId is required');
        }

        const numConversationId = parseInt(conversationId, 10);
        if (isNaN(numConversationId) || numConversationId <= 0) {
            throw new IllegalArgumentException('conversationId must be a positive number');
        }
    }

    /**
     * Valida que la conversación existe
     * @private
     */
    async validateConversationExists(conversationId, tenantId) {
        const conversation = await this.conversationRepository.findById(conversationId, tenantId);

        if (!conversation) {
            this.logger.warn('GetConversationMessagesUseCase', 'Conversation not found', {
                conversationId,
                tenantId
            });
            throw new IllegalArgumentException(`Conversation ${conversationId} not found`);
        }
    }

    /**
     * Valida y normaliza el número de página
     * @private
     */
    validateAndNormalizePage(page) {
        const numPage = parseInt(page, 10);

        if (isNaN(numPage) || numPage < 1) {
            this.logger.warn('GetConversationMessagesUseCase', 'Invalid page, using default', { page });
            return 1; // Default
        }

        return numPage;
    }

    /**
     * Valida y normaliza el límite de resultados
     * @private
     */
    validateAndNormalizeLimit(limit) {
        const numLimit = parseInt(limit, 10);

        if (isNaN(numLimit) || numLimit < 1) {
            this.logger.warn('GetConversationMessagesUseCase', 'Invalid limit, using default', { limit });
            return 50; // Default
        }

        // Aplicar límite máximo (regla de negocio)
        const MAX_LIMIT = 200;
        if (numLimit > MAX_LIMIT) {
            this.logger.warn('GetConversationMessagesUseCase', 'Limit exceeds maximum, capping', {
                requested: numLimit,
                max: MAX_LIMIT
            });
            return MAX_LIMIT;
        }

        return numLimit;
    }

    /**
     * Calcula si hay más mensajes disponibles
     * @private
     */
    calculateHasMore(page, limit, total) {
        const offset = (page - 1) * limit;
        const fetchedSoFar = offset + limit;
        return fetchedSoFar < total;
    }

    /**
     * Mapea un mensaje de dominio al formato esperado por el frontend
     * @private
     */
    mapToFrontendFormat(message) {
        return {
            // ===== IDENTIFICACIÓN =====
            id: message.id?.toString() || '',
            conversationId: message.chatSessionId?.toString() || '',

            // ===== CONTENIDO =====
            content: message.content || '',
            type: this.mapMessageType(message.messageType),

            // ===== REMITENTE/DESTINATARIO =====
            senderId: this.getSenderId(message),
            receiverId: this.getReceiverId(message),
            senderName: this.getSenderName(message),
            senderType: this.mapSenderType(message),

            // ===== CANAL Y ESTADO =====
            channel: this.getChannel(message),
            status: this.mapStatus(message.status),

            // ===== FECHAS =====
            timestamp: message.createdAt,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,

            // ===== METADATA Y CARACTERÍSTICAS =====
            metadata: this.buildMetadata(message),
            replyTo: null, // Por ahora no soportado
            isEdited: false, // Por ahora no soportado
            editedAt: null,
            isRead: message.status === 'read'
        };
    }

    /**
     * Mapea el tipo de mensaje
     * @private
     */
    mapMessageType(messageType) {
        const typeMap = {
            'text': 'text',
            'image': 'image',
            'audio': 'audio',
            'video': 'video',
            'document': 'file',
            'location': 'location',
            'contact': 'contact'
        };

        return typeMap[messageType] || 'text';
    }

    /**
     * Mapea el tipo de remitente
     * @private
     */
    mapSenderType(message) {
        if (message.direction === 'incoming') {
            return 'contact';
        }

        // Para mensajes salientes, usar responder_type si está disponible
        if (message.responderType === 'bot') {
            return 'bot';
        }

        if (message.responderType === 'human') {
            return 'agent';
        }

        return 'agent'; // Default para outgoing
    }

    /**
     * Mapea el estado del mensaje
     * @private
     */
    mapStatus(status) {
        const statusMap = {
            'sent': 'sent',
            'delivered': 'delivered',
            'read': 'read',
            'failed': 'failed'
        };

        return statusMap[status] || 'sent';
    }

    /**
     * Obtiene el ID del remitente
     * @private
     */
    getSenderId(message) {
        if (message.direction === 'incoming') {
            return message.contactId?.toString() || '';
        }

        // Para mensajes salientes, usar responded_by si está disponible
        return message.respondedBy?.toString() || 'system';
    }

    /**
     * Obtiene el ID del destinatario
     * @private
     */
    getReceiverId(message) {
        if (message.direction === 'incoming') {
            // El destinatario es el sistema/agente
            return message.respondedBy?.toString() || 'system';
        }

        // Para mensajes salientes, el destinatario es el contacto
        return message.contactId?.toString() || '';
    }

    /**
     * Obtiene el nombre del remitente
     * @private
     */
    getSenderName(message) {
        if (message.direction === 'incoming' && message.contact) {
            return message.contact.name || message.contact.phoneNumber || 'Unknown';
        }

        if (message.direction === 'outgoing') {
            return message.responderType === 'bot' ? 'Bot' : 'Agent';
        }

        return 'Unknown';
    }

    /**
     * Obtiene el canal de comunicación
     * @private
     */
    getChannel(message) {
        // Por defecto WhatsApp, pero se puede extender con metadata
        return message.chatSession?.metadata?.channel || 'whatsapp';
    }

    /**
     * Construye la metadata del mensaje
     * @private
     */
    buildMetadata(message) {
        const metadata = {
            originalChannel: this.getChannel(message),
            channelMessageId: message.whatsappMessageId || undefined
        };

        // Agregar attachments si hay media
        if (message.mediaUrl) {
            metadata.attachments = [{
                id: message.id?.toString() || '',
                type: this.mapMessageType(message.messageType),
                url: message.mediaUrl,
                filename: message.mediaMetadata?.filename || 'file',
                size: message.mediaMetadata?.size || 0,
                mimeType: message.mediaMetadata?.mimeType || 'application/octet-stream',
                thumbnail: message.mediaMetadata?.thumbnail
            }];
        }

        return metadata;
    }
}

module.exports = GetConversationMessagesUseCase;