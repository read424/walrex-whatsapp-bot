const { IllegalArgumentException } = require('../exceptions');

/**
 * Entidad de dominio: Package
 *
 * Representa un registro de paquete en el sistema.
 * Contiene la lógica de negocio y validaciones del dominio.
 */
class Package {
    constructor({ id = null, namePackage, title, message, createdAt = null, updatedAt = null }) {
        this.id = id;
        this.namePackage = namePackage;
        this.title = title;
        this.message = message;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    /**
     * Valida que los datos del paquete sean correctos
     * @throws {IllegalArgumentException} Si los datos son inválidos
     */
    validate() {
        if (!this.namePackage || this.namePackage.trim() === '') {
            throw new IllegalArgumentException('El nombre del paquete es requerido');
        }

        if (this.namePackage.length > 150) {
            throw new IllegalArgumentException('El nombre del paquete no puede exceder 150 caracteres');
        }

        if (!this.title || this.title.trim() === '') {
            throw new IllegalArgumentException('El título es requerido');
        }

        if (this.title.length > 60) {
            throw new IllegalArgumentException('El título no puede exceder 60 caracteres');
        }

        if (!this.message || this.message.trim() === '') {
            throw new IllegalArgumentException('El mensaje es requerido');
        }

        if (this.message.length > 255) {
            throw new IllegalArgumentException('El mensaje no puede exceder 255 caracteres');
        }
    }

    /**
     * Verifica si el paquete es nuevo (no tiene ID)
     * @returns {boolean}
     */
    isNew() {
        return this.id === null || this.id === undefined;
    }
}

module.exports = Package;