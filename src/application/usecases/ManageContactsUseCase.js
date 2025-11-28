const {
    ContactAlreadyExistsException
} = require('../../domain/exceptions/ChatExceptions');
const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Gestionar contactos (búsqueda y creación)
 *
 * Responsabilidad:
 * - Buscar contactos con filtros y paginación
 * - Crear nuevos contactos
 * - Validar datos de entrada
 * - Prevenir duplicados
 * - Aplicar reglas de negocio para contactos
 *
 * Dependencias inyectadas:
 * - contactRepository: Para operaciones CRUD de contactos
 * - logger: Para registrar operaciones y errores
 */
class ManageContactsUseCase {
    constructor(contactRepository, logger) {
        if (!contactRepository) {
            throw new Error('contactRepository is required');
        }
        if (!logger) {
            throw new Error('logger is required');
        }

        this.contactRepository = contactRepository;
        this.logger = logger;
    }

    /**
     * Busca contactos con filtros opcionales
     *
     * @param {Object} params - Parámetros de búsqueda
     * @param {number} params.tenantId - ID del tenant
     * @param {string} [params.search] - Término de búsqueda (nombre o teléfono)
     * @param {number} [params.limit=50] - Límite de resultados
     * @param {number} [params.offset=0] - Offset para paginación
     * @returns {Promise<Object>} - Resultado con contactos y metadatos
     * @throws {IllegalArgumentException} - Si los parámetros son inválidos
     */
    async searchContacts({ tenantId, search, limit = 50, offset = 0 }) {
        this.logger.info('ManageContactsUseCase', 'Searching contacts', {
            tenantId,
            search,
            limit,
            offset
        });

        // 1. Validar tenantId
        this.validateTenantId(tenantId);

        // 2. Validar y normalizar parámetros de paginación
        const normalizedLimit = this.validateAndNormalizeLimit(limit);
        const normalizedOffset = this.validateAndNormalizeOffset(offset);

        // 3. Normalizar término de búsqueda
        const normalizedSearch = search ? search.trim() : undefined;

        // 4. Buscar contactos en el repositorio
        const contacts = await this.contactRepository.findByTenant(tenantId, {
            search: normalizedSearch,
            limit: normalizedLimit,
            offset: normalizedOffset
        });

        this.logger.info('ManageContactsUseCase', 'Contacts retrieved successfully', {
            tenantId,
            count: contacts.length
        });

        // 5. Retornar resultado
        return {
            data: contacts,
            pagination: {
                limit: normalizedLimit,
                offset: normalizedOffset,
                total: contacts.length
            }
        };
    }

    /**
     * Crea un nuevo contacto
     *
     * @param {Object} params - Datos del contacto
     * @param {number} params.tenantId - ID del tenant
     * @param {string} params.phoneNumber - Número de teléfono
     * @param {string} [params.name] - Nombre del contacto
     * @param {Object} [params.metadata] - Metadatos adicionales
     * @returns {Promise<Object>} - Contacto creado
     * @throws {IllegalArgumentException} - Si los datos son inválidos
     * @throws {ContactAlreadyExistsException} - Si el contacto ya existe
     */
    async createContact({ tenantId, phoneNumber, name, metadata = {} }) {
        this.logger.info('ManageContactsUseCase', 'Creating contact', {
            tenantId,
            phoneNumber,
            hasName: !!name
        });

        // 1. Validar tenantId
        this.validateTenantId(tenantId);

        // 2. Validar y normalizar phoneNumber
        const normalizedPhoneNumber = this.validateAndNormalizePhoneNumber(phoneNumber);

        // 3. Validar nombre (opcional)
        const normalizedName = this.validateAndNormalizeName(name);

        // 4. Validar metadata
        this.validateMetadata(metadata);

        // 5. Verificar que el contacto no exista (prevenir duplicados)
        await this.checkContactDoesNotExist(tenantId, normalizedPhoneNumber);

        // 6. Crear contacto
        const contact = await this.contactRepository.create({
            tenantId,
            phoneNumber: normalizedPhoneNumber,
            name: normalizedName,
            metadata: metadata || {}
        });

        this.logger.info('ManageContactsUseCase', 'Contact created successfully', {
            contactId: contact.id,
            tenantId
        });

        return contact;
    }

    /**
     * Valida el tenantId
     * @private
     */
    validateTenantId(tenantId) {
        if (!tenantId) {
            throw new IllegalArgumentException('tenantId is required');
        }

        const numTenantId = parseInt(tenantId, 10);
        if (isNaN(numTenantId) || numTenantId <= 0) {
            throw new IllegalArgumentException('tenantId must be a positive number');
        }
    }

    /**
     * Valida y normaliza el número de teléfono
     * @private
     */
    validateAndNormalizePhoneNumber(phoneNumber) {
        if (!phoneNumber) {
            throw new IllegalArgumentException('phoneNumber is required');
        }

        if (typeof phoneNumber !== 'string') {
            throw new IllegalArgumentException('phoneNumber must be a string');
        }

        // Eliminar espacios y caracteres no numéricos excepto '+'
        const normalized = phoneNumber.trim().replace(/[^\d+]/g, '');

        if (normalized.length === 0) {
            throw new IllegalArgumentException('phoneNumber cannot be empty');
        }

        // Validación básica de formato (regla de negocio)
        // Debe tener al menos 8 dígitos y máximo 15 (estándar internacional E.164)
        const digitsOnly = normalized.replace(/\+/g, '');
        if (digitsOnly.length < 8 || digitsOnly.length > 15) {
            throw new IllegalArgumentException(
                'phoneNumber must have between 8 and 15 digits'
            );
        }

        return normalized;
    }

    /**
     * Valida y normaliza el nombre
     * @private
     */
    validateAndNormalizeName(name) {
        if (!name) {
            return undefined;
        }

        if (typeof name !== 'string') {
            throw new IllegalArgumentException('name must be a string');
        }

        const normalized = name.trim();

        if (normalized.length === 0) {
            return undefined;
        }

        // Validación de longitud máxima (regla de negocio)
        if (normalized.length > 100) {
            throw new IllegalArgumentException('name cannot exceed 100 characters');
        }

        return normalized;
    }

    /**
     * Valida metadata
     * @private
     */
    validateMetadata(metadata) {
        if (metadata !== null && metadata !== undefined) {
            if (typeof metadata !== 'object') {
                throw new IllegalArgumentException('metadata must be an object');
            }

            if (Array.isArray(metadata)) {
                throw new IllegalArgumentException('metadata cannot be an array');
            }
        }
    }

    /**
     * Verifica que el contacto no exista
     * @private
     */
    async checkContactDoesNotExist(tenantId, phoneNumber) {
        const existingContact = await this.contactRepository.findByPhoneNumber(
            phoneNumber,
            tenantId
        );

        if (existingContact) {
            this.logger.warn('ManageContactsUseCase', 'Contact already exists', {
                phoneNumber,
                tenantId,
                existingContactId: existingContact.id
            });
            throw new ContactAlreadyExistsException(
                `Contact with phone number ${phoneNumber} already exists`
            );
        }
    }

    /**
     * Valida y normaliza el límite de resultados
     * @private
     */
    validateAndNormalizeLimit(limit) {
        const numLimit = parseInt(limit, 10);

        if (isNaN(numLimit) || numLimit < 1) {
            this.logger.warn('ManageContactsUseCase', 'Invalid limit, using default', { limit });
            return 50; // Default
        }

        // Aplicar límite máximo (regla de negocio)
        const MAX_LIMIT = 100;
        if (numLimit > MAX_LIMIT) {
            this.logger.warn('ManageContactsUseCase', 'Limit exceeds maximum, capping', {
                requested: numLimit,
                max: MAX_LIMIT
            });
            return MAX_LIMIT;
        }

        return numLimit;
    }

    /**
     * Valida y normaliza el offset
     * @private
     */
    validateAndNormalizeOffset(offset) {
        const numOffset = parseInt(offset, 10);

        if (isNaN(numOffset) || numOffset < 0) {
            this.logger.warn('ManageContactsUseCase', 'Invalid offset, using default', { offset });
            return 0; // Default
        }

        return numOffset;
    }
}

module.exports = ManageContactsUseCase;