const { PackagesName } = require('./PackagesName.entity');
const structuredLogger = require('../../config/StructuredLogger');
// Logger ya no necesario, usando structuredLogger directamente

class PackageNameRepository {

    async addPackageName(package_name, title, message){
        try{
            const _package = await PackagesName.create({
                name: package_name,
                title: title,
                message: message
            });
            return _package;
        }catch(error){
            structuredLogger.error('PackageNameRepository', 'Error adding package name', error, {
                package_name,
                title,
                message
            });
            throw error;
        }
    }
}

module.exports = PackageNameRepository;