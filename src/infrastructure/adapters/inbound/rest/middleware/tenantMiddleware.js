/**
 * Middleware para extraer y validar el Tenant ID de los headers
 *
 * Extrae el tenant ID del header X-Tenant-Id y lo adjunta a req.user
 * Si ya existe req.user (de autenticación), preserva sus valores
 */
function extractTenantId(req, res, next) {
    // Extraer tenant ID del header
    const tenantIdFromHeader = req.headers['x-tenant-id'] || req.headers['X-Tenant-Id'];

    if (!tenantIdFromHeader) {
        return res.status(400).json({
            success: false,
            message: 'X-Tenant-Id header is required'
        });
    }

    // Convertir a número
    const tenantId = parseInt(tenantIdFromHeader, 10);

    if (isNaN(tenantId) || tenantId <= 0) {
        return res.status(400).json({
            success: false,
            message: 'X-Tenant-Id must be a valid positive integer'
        });
    }

    // Inicializar req.user si no existe
    if (!req.user) {
        req.user = {};
    }

    // Asignar tenant ID al objeto user
    req.user.tenantId = tenantId;

    next();
}

module.exports = extractTenantId;
