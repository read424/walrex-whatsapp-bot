class TokenGenerator {
    /**
     * Genera un JWT token para el usuario
     * @param {User} user - Usuario autenticado
     * @returns {Promise<string>} - JWT token
     */
    async generateToken(user) {
      throw new Error('Method must be implemented');
    }
  
    /**
     * Valida si un token es válido
     * @param {string} token - JWT token
     * @returns {Promise<boolean>} - True si es válido
     */
    async validateToken(token) {
      throw new Error('Method must be implemented');
    }
}

module.exports = TokenGenerator;