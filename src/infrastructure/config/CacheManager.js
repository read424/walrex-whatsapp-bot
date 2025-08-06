const structuredLogger = require('./StructuredLogger');

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.ttl = new Map(); // Time To Live
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
        this.defaultTTL = 300000; // 5 minutos en milisegundos
    }

    /**
     * Establece un valor en el cache
     * @param {string} key - Clave del cache
     * @param {any} value - Valor a cachear
     * @param {number} ttl - Tiempo de vida en milisegundos
     */
    set(key, value, ttl = this.defaultTTL) {
        const startTime = Date.now();
        
        try {
            this.cache.set(key, value);
            this.ttl.set(key, Date.now() + ttl);
            this.stats.sets++;

            structuredLogger.performance('CacheManager', 'set', Date.now() - startTime, {
                key,
                valueSize: JSON.stringify(value).length,
                ttl
            });

            structuredLogger.debug('CacheManager', 'Cache set successfully', {
                key,
                ttl: ttl / 1000 + 's'
            });
        } catch (error) {
            structuredLogger.error('CacheManager', 'Error setting cache', error, {
                key,
                ttl
            });
        }
    }

    /**
     * Obtiene un valor del cache
     * @param {string} key - Clave del cache
     * @returns {any} - Valor cacheado o null si no existe o expiró
     */
    get(key) {
        const startTime = Date.now();
        
        try {
            // Verificar si existe y no ha expirado
            if (this.cache.has(key)) {
                const expirationTime = this.ttl.get(key);
                
                if (Date.now() < expirationTime) {
                    this.stats.hits++;
                    
                    structuredLogger.performance('CacheManager', 'get', Date.now() - startTime, {
                        key,
                        hit: true
                    });

                    structuredLogger.debug('CacheManager', 'Cache hit', { key });
                    return this.cache.get(key);
                } else {
                    // Expiró, eliminar
                    this.delete(key);
                }
            }

            this.stats.misses++;
            
            structuredLogger.performance('CacheManager', 'get', Date.now() - startTime, {
                key,
                hit: false
            });

            structuredLogger.debug('CacheManager', 'Cache miss', { key });
            return null;
        } catch (error) {
            structuredLogger.error('CacheManager', 'Error getting from cache', error, { key });
            return null;
        }
    }

    /**
     * Elimina un valor del cache
     * @param {string} key - Clave del cache
     */
    delete(key) {
        try {
            this.cache.delete(key);
            this.ttl.delete(key);
            this.stats.deletes++;

            structuredLogger.debug('CacheManager', 'Cache deleted', { key });
        } catch (error) {
            structuredLogger.error('CacheManager', 'Error deleting from cache', error, { key });
        }
    }

    /**
     * Verifica si existe una clave en el cache
     * @param {string} key - Clave del cache
     * @returns {boolean} - True si existe y no ha expirado
     */
    has(key) {
        if (this.cache.has(key)) {
            const expirationTime = this.ttl.get(key);
            return Date.now() < expirationTime;
        }
        return false;
    }

    /**
     * Limpia todo el cache
     */
    clear() {
        try {
            this.cache.clear();
            this.ttl.clear();
            
            structuredLogger.info('CacheManager', 'Cache cleared completely');
        } catch (error) {
            structuredLogger.error('CacheManager', 'Error clearing cache', error);
        }
    }

    /**
     * Limpia entradas expiradas
     */
    cleanup() {
        const startTime = Date.now();
        let cleanedCount = 0;
        
        try {
            const now = Date.now();
            for (const [key, expirationTime] of this.ttl.entries()) {
                if (now >= expirationTime) {
                    this.cache.delete(key);
                    this.ttl.delete(key);
                    cleanedCount++;
                }
            }

            structuredLogger.performance('CacheManager', 'cleanup', Date.now() - startTime, {
                cleanedCount
            });

            if (cleanedCount > 0) {
                structuredLogger.info('CacheManager', 'Cache cleanup completed', {
                    cleanedCount
                });
            }
        } catch (error) {
            structuredLogger.error('CacheManager', 'Error during cache cleanup', error);
        }
    }

    /**
     * Obtiene estadísticas del cache
     * @returns {Object} - Estadísticas del cache
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            size: this.cache.size,
            hitRate: `${hitRate}%`,
            hits: this.stats.hits,
            misses: this.stats.misses,
            sets: this.stats.sets,
            deletes: this.stats.deletes,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Obtiene todas las claves del cache
     * @returns {Array} - Array de claves
     */
    keys() {
        return Array.from(this.cache.keys());
    }

    /**
     * Obtiene el tamaño del cache
     * @returns {number} - Número de elementos en el cache
     */
    size() {
        return this.cache.size;
    }

    /**
     * Establece el TTL por defecto
     * @param {number} ttl - Tiempo de vida en milisegundos
     */
    setDefaultTTL(ttl) {
        this.defaultTTL = ttl;
        structuredLogger.info('CacheManager', 'Default TTL updated', { ttl });
    }
}

// Singleton para el cache manager
const cacheManager = new CacheManager();

// Limpiar cache expirado cada 5 minutos
setInterval(() => {
    cacheManager.cleanup();
}, 5 * 60 * 1000);

module.exports = cacheManager; 