const bcrypt = require('bcrypt');
const PasswordHasherPort = require('../../../../application/ports/output/PasswordHasherPort');

/**
 * BcryptPasswordHasher
 *
 * Adaptador que implementa PasswordHasherPort usando la biblioteca bcrypt.
 * Este adaptador pertenece a la capa de infraestructura y contiene los detalles
 * técnicos de cómo se hashean y comparan las contraseñas.
 *
 * Responsabilidades:
 * - Implementar el hashing usando bcrypt con configuración apropiada
 * - Manejar errores específicos de bcrypt
 * - Proporcionar valores por defecto seguros (salt rounds)
 * - Logging estructurado de operaciones de seguridad
 */
class BcryptPasswordHasher extends PasswordHasherPort {
    /**
     * @param {number} saltRounds - Número de rondas de salt para bcrypt (default: 10)
     *                               Valores más altos = más seguro pero más lento
     * @param {LoggerPort} logger - Logger para operaciones de seguridad
     */
    constructor(saltRounds = 10, logger) {
        super();
        this.saltRounds = saltRounds;
        this.logger = logger;
    }

    /**
     * Compara una contraseña en texto plano con su versión hasheada usando bcrypt
     *
     * @param {string} plainPassword - Contraseña en texto plano
     * @param {string} hashedPassword - Contraseña hasheada
     * @returns {Promise<boolean>} True si coinciden, false en caso contrario
     * @throws {Error} Si ocurre un error durante la comparación
     */
    async compare(plainPassword, hashedPassword) {
        try {
            // Validación de entrada
            if (!plainPassword || typeof plainPassword !== 'string') {
                this.logger.warn('BcryptPasswordHasher', 'Invalid plain password provided for comparison');
                return false;
            }

            if (!hashedPassword || typeof hashedPassword !== 'string') {
                this.logger.warn('BcryptPasswordHasher', 'Invalid hashed password provided for comparison');
                return false;
            }

            // bcrypt.compare es asíncrono y seguro contra timing attacks
            const result = await bcrypt.compare(plainPassword, hashedPassword);

            this.logger.debug('BcryptPasswordHasher', 'Password comparison completed', {
                matched: result
            });

            return result;
        } catch (error) {
            // Log del error pero no exponer detalles al exterior por seguridad
            this.logger.error('BcryptPasswordHasher', 'Error comparing passwords with bcrypt', error);
            throw new Error('Password comparison failed');
        }
    }

    /**
     * Hashea una contraseña en texto plano usando bcrypt
     *
     * @param {string} plainPassword - Contraseña en texto plano
     * @returns {Promise<string>} La contraseña hasheada
     * @throws {Error} Si la contraseña es inválida o el hashing falla
     */
    async hash(plainPassword) {
        try {
            // Validación de entrada
            if (!plainPassword || typeof plainPassword !== 'string') {
                this.logger.warn('BcryptPasswordHasher', 'Invalid password provided for hashing: must be non-empty string');
                throw new Error('Password must be a non-empty string');
            }

            if (plainPassword.length === 0) {
                this.logger.warn('BcryptPasswordHasher', 'Empty password provided for hashing');
                throw new Error('Password cannot be empty');
            }

            // bcrypt.hash genera el salt automáticamente
            const hashedPassword = await bcrypt.hash(plainPassword, this.saltRounds);

            this.logger.debug('BcryptPasswordHasher', 'Password hashed successfully', {
                saltRounds: this.saltRounds
            });

            return hashedPassword;
        } catch (error) {
            this.logger.error('BcryptPasswordHasher', 'Error hashing password with bcrypt', error);
            throw new Error('Password hashing failed');
        }
    }
}

module.exports = BcryptPasswordHasher;