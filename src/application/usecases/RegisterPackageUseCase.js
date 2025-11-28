const Package = require('../../domain/model/Package');
const { IllegalArgumentException } = require('../../domain/exceptions');

/**
 * Caso de uso: Registrar un nuevo paquete
 *
 * Responsabilidades:
 * 1. Validar datos de entrada
 * 2. Crear entidad de dominio Package
 * 3. Validar reglas de negocio del dominio
 * 4. Verificar unicidad del título
 * 5. Persistir el paquete
 */
class RegisterPackageUseCase {
    constructor(packageRepository, logger) {
        this.packageRepository = packageRepository;
        this.logger = logger;
    }

    /**
     * Ejecuta el caso de uso para registrar un paquete
     * @param {Object} params - Parámetros de entrada
     * @param {string} params.namePackage - Nombre del paquete
     * @param {string} params.title - Título del paquete
     * @param {string} params.message - Mensaje del paquete
     * @returns {Promise<Package>} - Paquete registrado
     * @throws {IllegalArgumentException} Si los datos son inválidos
     */
    async execute({ namePackage, title, message }) {
        this.logger.info('RegisterPackageUseCase', 'Executing register package use case', {
            namePackage,
            title
        });

        // Crear entidad de dominio
        const packageEntity = new Package({
            namePackage,
            title,
            message
        });

        // Validar reglas de negocio del dominio
        packageEntity.validate();

        // Verificar que el título sea único
        const existingPackage = await this.packageRepository.findByTitle(title);
        if (existingPackage) {
            this.logger.warn('RegisterPackageUseCase', 'Package title already exists', { title });
            throw new IllegalArgumentException(`Ya existe un paquete con el título: ${title}`);
        }

        // Persistir el paquete
        const savedPackage = await this.packageRepository.save(packageEntity);

        this.logger.info('RegisterPackageUseCase', 'Package registered successfully', {
            packageId: savedPackage.id,
            title: savedPackage.title
        });

        return savedPackage;
    }
}

module.exports = RegisterPackageUseCase;