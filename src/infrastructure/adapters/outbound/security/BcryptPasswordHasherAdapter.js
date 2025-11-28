const bcrypt = require('bcrypt');

/**
 * Adaptador para hash y verificación de contraseñas usando bcrypt
 * Implementa la interfaz de PasswordHasher
 */
class BcryptPasswordHasherAdapter {
    constructor() {
        this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    }

    /**
     * Hashea una contraseña en texto plano
     * @param {string} plainPassword - Contraseña en texto plano
     * @returns {Promise<string>} - Hash de la contraseña
     */
    async hash(plainPassword) {
        try {
            const hashedPassword = await bcrypt.hash(plainPassword, this.saltRounds);
            return hashedPassword;
        } catch (error) {
            throw new Error(`Error hashing password: ${error.message}`);
        }
    }

    /**
     * Compara una contraseña en texto plano con un hash
     * @param {string} plainPassword - Contraseña en texto plano
     * @param {string} hashedPassword - Hash almacenado
     * @returns {Promise<boolean>} - true si coinciden, false si no
     */
    async compare(plainPassword, hashedPassword) {
        try {
            const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
            return isMatch;
        } catch (error) {
            throw new Error(`Error comparing password: ${error.message}`);
        }
    }
}

module.exports = BcryptPasswordHasherAdapter;
