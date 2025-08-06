const RegistryPackageOutputPort = require('../../../application/ports/output/RegistryPackageOutputPort');
const PackageNameRepository = require('./PackageNameRepository');

class SequelizePackageAdapter extends RegistryPackageOutputPort {
    constructor() {
        super();
        this.packageRepository = new PackageNameRepository();
    }

    async savePackage(packageData) {
        try {
            const { packageName, title, message } = packageData;
            const savedPackage = await this.packageRepository.addPackageName(packageName, title, message);
            return savedPackage;
        } catch (error) {
            throw new Error(`Failed to save package: ${error.message}`);
        }
    }
}

module.exports = SequelizePackageAdapter; 