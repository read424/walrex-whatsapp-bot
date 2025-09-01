class AuthenticationUseCase {
    /**
     * Autentica un usuario empleado para acceso al panel de ventas
     * @param {Object} credentials - Credenciales de autenticación
     * @param {string} credentials.email - Email del usuario
     * @param {string} credentials.password - Contraseña en texto plano
     * @returns {Promise<Object>} - Datos del usuario autenticado y token
     * @throws {IllegalArgumentException} - Si las credenciales son inválidas
     * @throws {AuthenticationException} - Si la autenticación falla
     */
    async authenticate(credentials) {
      throw new Error('Method must be implemented');
    }
  
    /**
     * Actualiza el último login del usuario
     * @param {number} userId - ID del usuario
     * @returns {Promise<void>}
     */
    async updateLastLogin(userId) {
      throw new Error('Method must be implemented');
    }
}

module.exports = AuthenticationUseCase;