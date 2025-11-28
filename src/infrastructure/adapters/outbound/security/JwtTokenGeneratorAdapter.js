const jwt = require('jsonwebtoken');

/**
 * Adaptador para generación de tokens JWT
 * Implementa la interfaz de generación de tokens
 */
class JwtTokenGeneratorAdapter {
    constructor() {
        this.secret = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
        this.expiresIn = process.env.JWT_EXPIRES_IN || '1h';
    }

    /**
     * Genera un token JWT para un usuario
     * @param {Object} user - Entidad de dominio User
     * @returns {Promise<string>} - Token JWT
     */
    async generateToken(user) {
        try {
            const payload = {
                userId: user.id,
                username: user.username,
                userType: user.user_type?.name || user.userType?.name,
                idUserType: user.idUserType
            };

            const token = jwt.sign(payload, this.secret, {
                expiresIn: this.expiresIn,
                issuer: 'bot-walrexapp'
            });

            return token;
        } catch (error) {
            throw new Error(`Error generating token: ${error.message}`);
        }
    }

    /**
     * Verifica y decodifica un token JWT
     * @param {string} token - Token a verificar
     * @returns {Promise<Object>} - Payload decodificado
     */
    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.secret);
            return decoded;
        } catch (error) {
            throw new Error(`Invalid or expired token: ${error.message}`);
        }
    }
}

module.exports = JwtTokenGeneratorAdapter;
