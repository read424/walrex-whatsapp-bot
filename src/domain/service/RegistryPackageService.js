const {RegistryPackageInputPort} = require("./../../application/ports/input");
const {SequelizePackageAdapter} = require("../../infrastructure/adapters/outbound");


class RegistryPackageService extends RegistryPackageInputPort {

    constructor() {
        super();
        this.outputAdapter = new SequelizePackageAdapter();
    }
    
    async registryPackage(packageData) {
        try {
            // Lógica de negocio (si es necesaria)
            const savedPackage = await this.outputAdapter.savePackage(packageData);
            return { success: true, data: savedPackage };
        } catch (error) {
            throw new Error(`Failed to registry package: ${error.message}`);
        }
    }    
}

module.exports = RegistryPackageService