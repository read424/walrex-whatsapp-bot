const { IllegalArgumentException } = require('../exceptions');

/**
 * Entidad de dominio Connection
 * Representa una conexión WhatsApp en el sistema
 * Contiene SOLO lógica de negocio, sin dependencias de infraestructura
 */
class Connection {
    constructor({
        id = null,
        connectionName,
        providerType = 'whatsapp',
        department,
        welcomeMessage = null,
        goodbyeMessage = null,
        chatbotTimeout = 30,
        tenantId,
        status = 'inactive',
        qrCode = null,
        phoneNumber = null,
        createdAt = new Date(),
        updatedAt = new Date()
    }) {
        this.id = id;
        this.connectionName = connectionName;
        this.providerType = providerType;
        this.department = department;
        this.welcomeMessage = welcomeMessage;
        this.goodbyeMessage = goodbyeMessage;
        this.chatbotTimeout = chatbotTimeout;
        this.tenantId = tenantId;
        this.status = status; // 'inactive', 'qr_ready', 'connecting', 'active', 'disconnected', 'error'
        this.qrCode = qrCode;
        this.phoneNumber = phoneNumber;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    /**
     * Valida que el nombre de la conexión sea válido
     */
    validateName() {
        if (!this.connectionName || typeof this.connectionName !== 'string') {
            throw new IllegalArgumentException('El nombre de la conexión es requerido');
        }

        if (this.connectionName.trim().length === 0) {
            throw new IllegalArgumentException('El nombre de la conexión no puede estar vacío');
        }

        if (this.connectionName.length > 100) {
            throw new IllegalArgumentException('El nombre de la conexión no puede exceder 100 caracteres');
        }
    }

    /**
     * Valida que el departamento sea válido
     */
    validateDepartment() {
        if (!this.department) {
            throw new IllegalArgumentException('El departamento es requerido');
        }
    }

    /**
     * Valida que el tenantId sea válido
     */
    validateTenantId() {
        if (!this.tenantId) {
            throw new IllegalArgumentException('El tenantId es requerido');
        }
    }

    /**
     * Valida toda la entidad antes de crear/actualizar
     */
    validate() {
        this.validateName();
        this.validateDepartment();
        this.validateTenantId();
    }

    /**
     * Verifica si la conexión está activa
     */
    isActive() {
        return this.status === 'active';
    }

    /**
     * Verifica si la conexión está desconectada
     */
    isDisconnected() {
        return this.status === 'disconnected' || this.status === 'inactive';
    }

    /**
     * Verifica si la conexión puede ser reiniciada
     */
    canRestart() {
        return ['inactive', 'disconnected', 'error'].includes(this.status);
    }

    /**
     * Verifica si la conexión está en proceso de conexión
     */
    isConnecting() {
        return this.status === 'connecting' || this.status === 'qr_ready';
    }

    /**
     * Cambia el estado de la conexión
     * Aplica validaciones de negocio para transiciones de estado válidas
     */
    changeStatus(newStatus) {
        const validStatuses = ['inactive', 'qr_ready', 'connecting', 'active', 'disconnected', 'error'];

        if (!validStatuses.includes(newStatus)) {
            throw new IllegalArgumentException(`Estado inválido: ${newStatus}`);
        }

        // Validar transiciones de estado permitidas
        const allowedTransitions = {
            'inactive': ['qr_ready', 'connecting', 'error'],
            'qr_ready': ['connecting', 'inactive', 'error'],
            'connecting': ['active', 'error', 'disconnected'],
            'active': ['disconnected', 'error'],
            'disconnected': ['inactive', 'qr_ready', 'connecting'],
            'error': ['inactive', 'qr_ready']
        };

        const allowed = allowedTransitions[this.status] || [];
        if (!allowed.includes(newStatus)) {
            throw new IllegalArgumentException(
                `Transición de estado no permitida: ${this.status} -> ${newStatus}`
            );
        }

        this.status = newStatus;
        this.updatedAt = new Date();
    }

    /**
     * Actualiza el QR code
     */
    setQRCode(qrCode) {
        if (!qrCode || typeof qrCode !== 'string') {
            throw new IllegalArgumentException('QR code inválido');
        }
        this.qrCode = qrCode;
        this.updatedAt = new Date();
    }

    /**
     * Establece el número de teléfono cuando se conecta
     */
    setPhoneNumber(phoneNumber) {
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            throw new IllegalArgumentException('Número de teléfono inválido');
        }
        this.phoneNumber = phoneNumber;
        this.updatedAt = new Date();
    }

    /**
     * Actualiza mensajes de bienvenida/despedida
     */
    updateMessages({ welcomeMessage, goodbyeMessage }) {
        if (welcomeMessage !== undefined) {
            this.welcomeMessage = welcomeMessage;
        }
        if (goodbyeMessage !== undefined) {
            this.goodbyeMessage = goodbyeMessage;
        }
        this.updatedAt = new Date();
    }

    /**
     * Actualiza el timeout del chatbot
     */
    updateChatbotTimeout(timeout) {
        if (typeof timeout !== 'number' || timeout < 1) {
            throw new IllegalArgumentException('El timeout debe ser un número mayor a 0');
        }
        this.chatbotTimeout = timeout;
        this.updatedAt = new Date();
    }

    /**
     * Convierte la entidad a objeto plano para serialización
     */
    toJSON() {
        return {
            id: this.id,
            connectionName: this.connectionName,
            providerType: this.providerType,
            department: this.department,
            welcomeMessage: this.welcomeMessage,
            goodbyeMessage: this.goodbyeMessage,
            chatbotTimeout: this.chatbotTimeout,
            tenantId: this.tenantId,
            status: this.status,
            qrCode: this.qrCode,
            phoneNumber: this.phoneNumber,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = Connection;