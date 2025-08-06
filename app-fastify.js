const env = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: `.env.${env}` });

const Fastify = require('fastify');
const cors = require('@fastify/cors');

const routes = require('./src/routes/fastify/routes');

const WhatsAppContextSingleton = require('./src/whatsappContextSingleton');
const { WhatsAppWebJsStrategy, VenomStrategy } = require('./src/strategies/');

// Inicializar Fastify
const fastify = Fastify({
  logger: true,
});

// Configurar CORS
fastify.register(cors);

// Variables de entorno
const port = process.env.PORT || 3000;

// Determinar estrategia
let strategy;
const selectedLibrary = process.env.WHATSAPP_LIBRARY;

if (selectedLibrary === 'venom') {
    strategy = new VenomStrategy();
} else if (selectedLibrary === 'whatsapp-web.js') {
    strategy = new WhatsAppWebJsStrategy();
} else {
    throw new Error('Library not supported');
}

// Crear una instancia de WhatsAppContextSingleton
const whatsappContext = WhatsAppContextSingleton.getInstance(strategy);

// Inicializar el cliente de WhatsApp
(async () => {
    try {
        await whatsappContext.init();
        fastify.log.info('WhatsApp client initialized.');
    } catch (error) {
        fastify.log.error('Failed to initialize strategy:', error);
    }
})();


// Middleware para inyectar `whatsappContext` en las solicitudes
fastify.addHook('onRequest', async (request, reply) => {
    request.whatsappContext = whatsappContext;
});

// Registrar las rutas de la API
routes.forEach((route) => {
    fastify.route(route);
});

// Iniciar el servidor
const startServer = async () => {
    try {
        await fastify.listen({ port });
        fastify.log.info(`Server running on port ${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Manejo de señales para un cierre ordenado
const gracefulShutdown = async () => {
    fastify.log.info('Recibida señal SIGINT. Cerrando servidor...');
    try {
      await fastify.close();
      fastify.log.info('Servidor cerrado correctamente.');
      process.exit(0);
    } catch (error) {
      fastify.log.error('Error durante el cierre del servidor:', error);
      process.exit(1);
    }
};

process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', async (error) => {
    fastify.log.error('Exception no catch:', error);
    await gracefulShutdown();
});

process.on('unhandledRejection', async (reason, promise) => {
    fastify.log.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await gracefulShutdown();
});
  
startServer();