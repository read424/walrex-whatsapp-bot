/**
 * Controlador REST para endpoints de Autenticación
 * Responsabilidades:
 * - Extraer parámetros HTTP
 * - Llamar casos de uso inyectados
 * - Mapear respuestas a HTTP
 * - Manejo de errores HTTP
 *
 * NO contiene lógica de negocio ni validaciones de negocio
 */
class AuthController {
    /**
     * @param {AuthenticateUserUseCase} authenticateUserUseCase - Caso de uso inyectado
     * @param {LoggerPort} logger - Puerto de logger inyectado
     */
    constructor(authenticateUserUseCase, logger) {
        this.authenticateUserUseCase = authenticateUserUseCase;
        this.logger = logger;
    }

    /**
     * POST /api/auth/login
     * Autenticar usuario empleado
     */
    async login(req, res) {
        try {
            const { email, password } = req.body;

            this.logger.info('AuthController', 'Login request', {
                email,
                correlationId: req.correlationId
            });

            // Ejecutar caso de uso
            const result = await this.authenticateUserUseCase.authenticate({
                email,
                password
            });

            this.logger.info('AuthController', 'Login successful', {
                userId: result.user.id,
                userType: result.userType,
                correlationId: req.correlationId
            });

            res.status(200).json({
                success: true,
                message: 'Autenticación exitosa',
                data: result
            });

        } catch (error) {
            this.handleError(error, req, res, 'login');
        }
    }

    /**
     * Manejo centralizado de errores HTTP
     */
    handleError(error, req, res, operation) {
        this.logger.error('AuthController', `Error in ${operation}`, {
            error: error.message,
            stack: error.stack,
            correlationId: req.correlationId
        });

        // Mapear excepciones de dominio a códigos HTTP
        if (error.name === 'IllegalArgumentException') {
            return res.status(400).json({
                success: false,
                message: error.message,
                error: {
                    code: 'INVALID_INPUT',
                    details: error.message
                }
            });
        }

        if (error.name === 'AuthenticationException') {
            return res.status(401).json({
                success: false,
                message: error.message,
                error: {
                    code: 'AUTHENTICATION_FAILED',
                    details: error.message
                }
            });
        }

        // Error genérico del sistema
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: {
                code: 'INTERNAL_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
}

module.exports = AuthController;