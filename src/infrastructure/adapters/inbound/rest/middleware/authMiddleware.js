const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticación JWT
 *
 * Responsabilidades:
 * - Extraer y validar el token Bearer del header Authorization
 * - Verificar la validez del token JWT
 * - Inyectar los datos del usuario autenticado en req.user
 * - Retornar errores HTTP apropiados si la autenticación falla
 *
 * Este middleware es parte de la capa de infraestructura/adaptadores
 */

/**
 * Middleware para verificar token JWT
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
function ensureAuthenticated(req, res, next) {
    try {
        // 1. Extraer token del header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Token de autenticación no proporcionado',
                error: {
                    code: 'MISSING_TOKEN',
                    details: 'Se requiere el header Authorization con formato: Bearer <token>'
                }
            });
        }

        // 2. Validar formato Bearer token
        const parts = authHeader.split(' ');

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                success: false,
                message: 'Formato de token inválido',
                error: {
                    code: 'INVALID_TOKEN_FORMAT',
                    details: 'El formato debe ser: Bearer <token>'
                }
            });
        }

        const token = parts[1];

        // 3. Verificar y decodificar el token
        const secret = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
        const decoded = jwt.verify(token, secret);

        // 4. Inyectar usuario autenticado en la request
        req.user = {
            id: decoded.userId,
            username: decoded.username,
            userType: decoded.userType,
            idUserType: decoded.idUserType
        };

        // 5. Continuar al siguiente middleware/controlador
        next();

    } catch (error) {
        // Manejo de errores específicos de JWT
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado',
                error: {
                    code: 'TOKEN_EXPIRED',
                    details: 'El token ha expirado, por favor inicie sesión nuevamente'
                }
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido',
                error: {
                    code: 'INVALID_TOKEN',
                    details: 'El token proporcionado no es válido'
                }
            });
        }

        // Error genérico
        return res.status(500).json({
            success: false,
            message: 'Error al verificar autenticación',
            error: {
                code: 'AUTH_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    }
}

/**
 * Middleware opcional para verificar tenant ID
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
function ensureTenantId(req, res, next) {
    const tenantId = req.headers['x-tenant-id'];

    if (!tenantId) {
        return res.status(400).json({
            success: false,
            message: 'Tenant ID no proporcionado',
            error: {
                code: 'MISSING_TENANT_ID',
                details: 'Se requiere el header X-Tenant-Id'
            }
        });
    }

    // Validar que sea un número válido
    const parsedTenantId = parseInt(tenantId);
    if (isNaN(parsedTenantId)) {
        return res.status(400).json({
            success: false,
            message: 'Tenant ID inválido',
            error: {
                code: 'INVALID_TENANT_ID',
                details: 'X-Tenant-Id debe ser un número válido'
            }
        });
    }

    req.tenantId = parsedTenantId;
    next();
}

module.exports = {
    ensureAuthenticated,
    ensureTenantId
};