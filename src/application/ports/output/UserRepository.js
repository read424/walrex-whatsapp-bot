class UserRepository {
    /**
     * Busca un usuario por email/username
     * @param {string} username - Email o username del usuario
     * @returns {Promise<User|null>} - Usuario encontrado o null
     */
    async findByUsername(username) {
      throw new Error('Method must be implemented');
    }
  
    /**
     * Actualiza el último login del usuario
     * @param {number} userId - ID del usuario
     * @param {Date} loginDate - Fecha del login
     * @returns {Promise<void>}
     */
    async updateLastLogin(userId, loginDate) {
      throw new Error('Method must be implemented');
    }
}

module.exports = UserRepository;