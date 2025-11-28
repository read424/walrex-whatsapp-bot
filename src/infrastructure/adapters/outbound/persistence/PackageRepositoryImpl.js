const PackageRepositoryPort = require('../../../../application/ports/output/PackageRepositoryPort');
const PackagesName = require('../PackagesName.entity');
const PackageDomain = require('../../../../domain/model/Package');

/**
 * Implementación del repositorio de paquetes usando Sequelize
 * Implementa el puerto PackageRepositoryPort
 * Mapea entre el modelo ORM (PackagesName) y la entidad de dominio (Package)
 */
class PackageRepositoryImpl extends PackageRepositoryPort {
    constructor() {
        super();
    }

    /**
     * Guarda un nuevo paquete
     * @param {Package} packageEntity - Entidad de dominio
     * @returns {Promise<Package>} - Package guardado con ID asignado
     */
    async save(packageEntity) {
        try {
            const packageModel = await PackagesName.create({
                name_package: packageEntity.namePackage,
                title: packageEntity.title,
                message: packageEntity.message
            });

            return this.toDomain(packageModel);
        } catch (error) {
            throw new Error(`Error saving package: ${error.message}`);
        }
    }

    /**
     * Busca un paquete por título
     * @param {string} title - Título del paquete
     * @returns {Promise<Package|null>} - Package encontrado o null
     */
    async findByTitle(title) {
        try {
            const packageModel = await PackagesName.findOne({
                where: { title }
            });

            if (!packageModel) {
                return null;
            }

            return this.toDomain(packageModel);
        } catch (error) {
            throw new Error(`Error finding package by title: ${error.message}`);
        }
    }

    /**
     * Busca todos los paquetes
     * @returns {Promise<Package[]>} - Array de packages
     */
    async findAll() {
        try {
            const packageModels = await PackagesName.findAll({
                order: [['create_at', 'DESC']]
            });

            return packageModels.map(model => this.toDomain(model));
        } catch (error) {
            throw new Error(`Error finding all packages: ${error.message}`);
        }
    }

    /**
     * Mapea de modelo ORM a entidad de dominio
     * @param {PackagesName} packageModel - Modelo Sequelize
     * @returns {Package} - Entidad de dominio
     */
    toDomain(packageModel) {
        const data = packageModel.get({ plain: true });

        return new PackageDomain({
            id: data.id,
            namePackage: data.name_package,
            title: data.title,
            message: data.message,
            createdAt: data.create_at,
            updatedAt: data.update_at
        });
    }
}

module.exports = PackageRepositoryImpl;