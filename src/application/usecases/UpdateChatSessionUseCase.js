const {
    SessionNotFoundException,
    InvalidUpdateDataException
} = require('../../domain/exceptions/ChatExceptions');

/**
 * Caso de uso: Actualizar sesión de chat
 *
 * Responsabilidad:
 * - Orquestar el proceso de actualización de sesiones de chat
 * - Validar que la sesión existe
 * - Validar que los datos de actualización son válidos
 * - Actualizar la sesión con los campos permitidos
 * - Notificar sobre la actualización a través de WebSocket
 * - Aplicar reglas de negocio relacionadas con actualizaciones
 *
 * Dependencias inyectadas:
 * - chatSessionRepository: Para obtener y actualizar sesiones
 * - notificationPort: Para notificar actualizaciones en tiempo real
 * - logger: Para registrar operaciones y errores
 */
class UpdateChatSessionUseCase {
    constructor(chatSessionRepository, notificationPort, logger) {
        if (!chatSessionRepository) {
            throw new Error('chatSessionRepository is required');
        }
        if (!notificationPort) {
            throw new Error('notificationPort is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.chatSessionRepository = chatSessionRepository;
        this.notificationPort = notificationPort;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso de actualización de sesión
     *
     * @param {Object} params - Parámetros del caso de uso
     * @param {number} params.sessionId - ID de la sesión de chat
     * @param {Object} params.updates - Datos a actualizar
     * @param {string} [params.updates.status] - Nuevo estado (open, closed, waiting, etc.)
     * @param {number} [params.updates.handledBy] - ID del asesor asignado
     * @param {Object} [params.updates.metadata] - Metadatos adicionales
     * @returns {Promise<Object>} - Sesión actualizada
     * @throws {SessionNotFoundException} - Si la sesión no existe
     * @throws {InvalidUpdateDataException} - Si los datos de actualización son inválidos
     */
    async execute({ sessionId, updates }) {
        this.logger.info('UpdateChatSessionUseCase', 'Starting session update process', {
            sessionId,
            updateFields: Object.keys(updates)
        });

        // 1. Validar que se proporcionaron datos para actualizar
        this.validateUpdateData(updates);

        // 2. Obtener sesión actual
        const session = await this.getSession(sessionId);

        // 3. Validar y filtrar campos permitidos
        const validatedUpdates = this.validateAndFilterUpdates(updates, session);

        // 4. Aplicar reglas de negocio antes de la actualización
        this.applyBusinessRules(session, validatedUpdates);

        // 5. Actualizar sesión en el repositorio
        const updatedSession = await this.updateSession(sessionId, validatedUpdates);

        // 6. Notificar actualización por WebSocket
        await this.notifyUpdate(updatedSession.tenantId, sessionId, validatedUpdates);

        this.logger.info('UpdateChatSessionUseCase', 'Session updated successfully', {
            sessionId,
            updatedFields: Object.keys(validatedUpdates)
        });

        return updatedSession;
    }

    /**
     * Valida que se proporcionaron datos para actualizar
     * @private
     */
    validateUpdateData(updates) {
        if (!updates || typeof updates !== 'object') {
            throw new InvalidUpdateDataException('Update data must be a non-null object');
        }

        if (Object.keys(updates).length === 0) {
            throw new InvalidUpdateDataException('No update fields provided');
        }
    }

    /**
     * Obtiene la sesión de chat
     * @private
     */
    async getSession(sessionId) {
        const session = await this.chatSessionRepository.findById(sessionId);

        if (!session) {
            this.logger.warn('UpdateChatSessionUseCase', 'Session not found', { sessionId });
            throw new SessionNotFoundException(`Session ${sessionId} not found`);
        }

        return session;
    }

    /**
     * Valida y filtra campos permitidos para actualización
     * @private
     */
    validateAndFilterUpdates(updates, session) {
        const ALLOWED_FIELDS = ['status', 'handledBy', 'metadata'];
        const validatedUpdates = {};

        for (const [field, value] of Object.entries(updates)) {
            if (!ALLOWED_FIELDS.includes(field)) {
                this.logger.warn('UpdateChatSessionUseCase', 'Attempted to update disallowed field', {
                    field,
                    allowedFields: ALLOWED_FIELDS
                });
                continue; // Ignorar campos no permitidos silenciosamente
            }

            // Validaciones específicas por campo
            if (field === 'status') {
                this.validateStatus(value);
                validatedUpdates.status = value;
            } else if (field === 'handledBy') {
                this.validateHandledBy(value);
                validatedUpdates.handledBy = value;
            } else if (field === 'metadata') {
                this.validateMetadata(value, session);
                // Hacer merge de metadata existente con nueva
                validatedUpdates.metadata = {
                    ...(session.metadata || {}),
                    ...value
                };
            }
        }

        if (Object.keys(validatedUpdates).length === 0) {
            throw new InvalidUpdateDataException('No valid fields to update');
        }

        return validatedUpdates;
    }

    /**
     * Valida el campo status
     * @private
     */
    validateStatus(status) {
        const VALID_STATUSES = ['open', 'waiting', 'closed', 'archived'];

        if (!VALID_STATUSES.includes(status)) {
            throw new InvalidUpdateDataException(
                `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`
            );
        }
    }

    /**
     * Valida el campo handledBy
     * @private
     */
    validateHandledBy(handledBy) {
        // Permitir null (desasignar) o número positivo
        if (handledBy !== null && handledBy !== undefined) {
            if (typeof handledBy !== 'number' || handledBy < 0) {
                throw new InvalidUpdateDataException(
                    'handledBy must be null or a positive number'
                );
            }
        }
    }

    /**
     * Valida el campo metadata
     * @private
     */
    validateMetadata(metadata, session) {
        if (metadata !== null && typeof metadata !== 'object') {
            throw new InvalidUpdateDataException('metadata must be null or an object');
        }

        if (Array.isArray(metadata)) {
            throw new InvalidUpdateDataException('metadata cannot be an array');
        }
    }

    /**
     * Aplica reglas de negocio antes de actualizar
     * @private
     */
    applyBusinessRules(session, updates) {
        // Regla: Si se cierra una sesión, debe tener un handledBy asignado
        if (updates.status === 'closed' && !session.handledBy && !updates.handledBy) {
            this.logger.warn('UpdateChatSessionUseCase', 'Attempting to close unassigned session', {
                sessionId: session.id
            });
            // Permitir, pero registrar advertencia
        }

        // Regla: No se puede reabrir una sesión archivada directamente
        if (session.status === 'archived' && updates.status && updates.status !== 'archived') {
            throw new InvalidUpdateDataException(
                'Cannot reopen an archived session. Create a new session instead.'
            );
        }

        // Regla: Al asignar, actualizar timestamp de asignación en metadata
        if (updates.handledBy && updates.handledBy !== session.handledBy) {
            if (!updates.metadata) {
                updates.metadata = session.metadata || {};
            }
            updates.metadata.assignedAt = new Date().toISOString();
        }
    }

    /**
     * Actualiza la sesión en el repositorio
     * @private
     */
    async updateSession(sessionId, updates) {
        try {
            return await this.chatSessionRepository.update(sessionId, updates);
        } catch (error) {
            this.logger.error('UpdateChatSessionUseCase', 'Error updating session', error, {
                sessionId,
                updates
            });
            throw error;
        }
    }

    /**
     * Notifica la actualización por WebSocket
     * @private
     */
    async notifyUpdate(tenantId, sessionId, updates) {
        try {
            await this.notificationPort.notifySessionUpdate(tenantId, sessionId, updates);
            this.logger.debug('UpdateChatSessionUseCase', 'Notification sent', {
                tenantId,
                sessionId
            });
        } catch (error) {
            // No fallar el caso de uso si la notificación falla
            this.logger.error('UpdateChatSessionUseCase', 'Error sending notification', error, {
                tenantId,
                sessionId
            });
        }
    }
}

module.exports = UpdateChatSessionUseCase;