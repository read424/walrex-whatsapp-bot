/**
 * PasswordHasherPort
 *
 * Puerto de salida que define el contrato para operaciones de hashing de contraseñas.
 * Este puerto abstrae la implementación específica de algoritmos criptográficos,
 * permitiendo que el dominio permanezca agnóstico de la tecnología utilizada.
 *
 * Principios de Arquitectura Hexagonal:
 * - El dominio define QUÉ necesita (comparar y hashear contraseñas)
 * - La infraestructura define CÓMO lo hace (bcrypt, argon2, scrypt, etc.)
 * - El dominio nunca depende de detalles de implementación
 */
class PasswordHasherPort {
    /**
     * Compara una contraseña en texto plano con su versión hasheada
     *
     * @param {string} plainPassword - Contraseña en texto plano
     * @param {string} hashedPassword - Contraseña hasheada para comparar
     * @returns {Promise<boolean>} True si las contraseñas coinciden, false en caso contrario
     * @throws {Error} Si el adaptador no implementa este método
     */
    async compare(plainPassword, hashedPassword) {
        throw new Error('Method compare() must be implemented by adapter');
    }

    /**
     * Hashea una contraseña en texto plano
     *
     * @param {string} plainPassword - Contraseña en texto plano a hashear
     * @returns {Promise<string>} La contraseña hasheada
     * @throws {Error} Si el adaptador no implementa este método
     */
    async hash(plainPassword) {
        throw new Error('Method hash() must be implemented by adapter');
    }
}

module.exports = PasswordHasherPort;