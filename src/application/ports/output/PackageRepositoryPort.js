/**
 * Puerto de salida (output port) para el repositorio de paquetes
 *
 * Define el contrato que debe cumplir cualquier adaptador de persistencia
 * para gestionar paquetes.
 *
 * Este puerto es parte de la capa de aplicación y será implementado
 * por adaptadores en la capa de infraestructura.
 */
class PackageRepositoryPort {
    /**
     * Guarda un nuevo paquete
     * @param {Package} packageEntity - Entidad de dominio Package
     * @returns {Promise<Package>} - Package guardado con ID asignado
     */
    async save(packageEntity) {
        throw new Error('Method save() must be implemented');
    }

    /**
     * Busca un paquete por título
     * @param {string} title - Título del paquete
     * @returns {Promise<Package|null>} - Package encontrado o null
     */
    async findByTitle(title) {
        throw new Error('Method findByTitle() must be implemented');
    }

    /**
     * Busca todos los paquetes
     * @returns {Promise<Package[]>} - Array de packages
     */
    async findAll() {
        throw new Error('Method findAll() must be implemented');
    }
}

module.exports = PackageRepositoryPort;