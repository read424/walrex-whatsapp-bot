const AuthenticationUseCase = require('../ports/input/AuthenticationUseCase');

/**
 * Caso de uso de aplicación que orquesta la autenticación
 * ESTE es el que implementa el puerto de entrada
 * USA el servicio de dominio (NO hereda de él)
 */
class AuthenticateUserUseCase extends AuthenticationUseCase {
    /**
     * @param {AuthenticationService} authenticationService - Servicio de dominio
     */
    constructor(authenticationService) {
        super();
        this.authenticationService = authenticationService;
    }

    /**
     * Ejecuta el caso de uso de autenticación
     * Delega la lógica de negocio al servicio de dominio
     */
    async authenticate(credentials) {
        return await this.authenticationService.authenticate(credentials);
    }

    /**
     * Actualiza el último login del usuario
     * Delega al servicio de dominio
     */
    async updateLastLogin(userId) {
        return await this.authenticationService.updateLastLogin(userId);
    }
}

module.exports = AuthenticateUserUseCase;