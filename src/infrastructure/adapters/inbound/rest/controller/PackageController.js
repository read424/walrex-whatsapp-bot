const { IllegalArgumentException } = require('../../../../../domain/exceptions');

/**
 * Controlador REST para operaciones de paquetes
 *
 * Responsabilidades:
 * 1. Extraer parámetros de la petición HTTP
 * 2. Llamar al caso de uso correspondiente
 * 3. Mapear la respuesta del caso de uso a formato HTTP
 * 4. Manejar errores y convertirlos en respuestas HTTP apropiadas
 *
 * NO contiene lógica de negocio.
 */
class PackageController {
    constructor(registerPackageUseCase, logger) {
        this.registerPackageUseCase = registerPackageUseCase;
        this.logger = logger;
    }

    /**
     * POST /api/packages/registry-name
     * Registrar un nuevo paquete
     */
    async registerPackage(req, res) {
        try {
            const { package: packageName, title, message } = req.body;

            this.logger.info('PackageController', 'Register package request received', {
                packageName,
                title,
                correlationId: req.correlationId
            });

            // Validación básica de entrada HTTP
            if (!packageName || !title || !message) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Los campos package, title y message son requeridos',
                        code: 'MISSING_REQUIRED_FIELDS'
                    }
                });
            }

            // Delegar al caso de uso
            const result = await this.registerPackageUseCase.execute({
                namePackage: packageName,
                title,
                message
            });

            this.logger.info('PackageController', 'Package registered successfully', {
                packageId: result.id,
                correlationId: req.correlationId
            });

            return res.status(201).json({
                success: true,
                data: {
                    id: result.id,
                    namePackage: result.namePackage,
                    title: result.title,
                    message: result.message,
                    createdAt: result.createdAt
                }
            });
        } catch (error) {
            this.logger.error('PackageController', 'Error registering package', error, {
                correlationId: req.correlationId
            });

            // Mapear excepciones de dominio a códigos HTTP
            if (error instanceof IllegalArgumentException) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: error.message,
                        code: 'VALIDATION_ERROR'
                    }
                });
            }

            // Error genérico
            return res.status(500).json({
                success: false,
                error: {
                    message: 'Error interno al registrar el paquete',
                    code: 'INTERNAL_SERVER_ERROR'
                }
            });
        }
    }
}

module.exports = PackageController;