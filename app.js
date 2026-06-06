// Configurar variables de entorno según el ambiente
const env = process.env.NODE_ENV || 'development';
const envFile = `.env.${env}`;

require('dotenv').config({ path: envFile });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const structuredLogger = require('./src/infrastructure/config/StructuredLogger');
const StructuredLoggerAdapter = require('./src/infrastructure/adapters/outbound/logging/StructuredLoggerAdapter');
const { setupDependencies } = require('./src/infrastructure/config/CompositionRoot');
const correlationMiddleware = require('./src/infrastructure/adapters/inbound/middlewares/correlationMiddleware');
const { WebSocketAdapter } = require('./src/infrastructure/adapters/inbound/');
const { WhatsAppConnectionManager } = require('./src/infrastructure/adapters/inbound');
const MONITORING_INTERVAL = process.env.MONITORING_INTERVAL || 5 * 60 * 1000;

// === CREAR LOGGER ADAPTER ===
const logger = new StructuredLoggerAdapter();

//inicializar express
const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
    credentials: true
})); // Permitir solicitudes de cualquier origen
app.use(bodyParser.json({ limit: '10mb' })); // Analizar solicitudes de contenido tipo application/json con límite de 10MB
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true })); // Para datos codificados en URL

// Servir archivos estáticos desde la carpeta public
app.use(express.static('public'));

// Middleware de correlation ID
app.use(correlationMiddleware);

// Crear servidor HTTP pero no iniciarlo aún
const server = require('http').createServer(app);
// Crear el adaptador WebSocket con logger inyectado
const webSocketAdapter = new WebSocketAdapter(server, logger);

// Crear el gestor
const connectionManager = new WhatsAppConnectionManager(webSocketAdapter, logger);

// Registrar el ConnectionManager globalmente para que las Strategies puedan acceder a él
// Esto permite que las conexiones se auto-limpien cuando fallen por timeout u otros errores
global.whatsAppConnectionManager = connectionManager;
structuredLogger.info('APP', 'ConnectionManager registered globally');

// === INYECTAR DEPENDENCIAS (Composition Root) ===
// IMPORTANTE: Ahora se ejecuta DESPUÉS de crear webSocketAdapter y connectionManager
// para poder inyectarlos en SendMessageToConversationUseCase
structuredLogger.info('APP', 'Setting up dependency injection with external adapters');
const { channelConnectionController } = setupDependencies({ webSocketAdapter, connectionManager });
structuredLogger.info('APP', 'Dependency injection completed');

// Ahora sí cargar las rutas (ya tienen los controladores inyectados con todas las dependencias)
const routes = require('./src/infrastructure/adapters/inbound/routes');

// Cargar rutas v2
const channelConnectionsRoutesV2 = require('./src/infrastructure/adapters/inbound/rest/routes/v2/connections')(channelConnectionController);

app.use(async (req, res, next) => {
    req.connectionManager = connectionManager;
    req.webSocketAdapter = webSocketAdapter;
    next();
});

// Cargar las rutas de la API
app.use('/api', routes);

// Cargar rutas v2
app.use('/api/v2/connections', channelConnectionsRoutesV2);

//Initialize the client 
(async () => {
    try {
        structuredLogger.info('APP', 'Initializing WhatsApp connection system');

        // Inicializar el sistema (incluye restauración automática de conexiones)
        //await connectionManager.initialize();

        // Iniciar monitoreo cada 30 segundos
        // TEMPORALMENTE DESHABILITADO: Causaba loop infinito
        // setInterval(() => connectionManager.monitorConnections(), MONITORING_INTERVAL);

        structuredLogger.info('APP', 'WhatsApp context initialized successfully', {
            action: 'context_initialized'
        });

        structuredLogger.info('APP', 'WhatsApp system initialized successfully');
    } catch (error) {
        structuredLogger.error('APP', 'Failed to initialize WhatsApp system', error);
    }
})();

// Iniciar el servidor
server.listen(port, () => {
    structuredLogger.info('APP', 'Server started successfully', {
        port,
        action: 'server_started'
    });
});

// Manejo de señales para un cierre ordenado
const gracefulShutdown = async (signal) => {
    structuredLogger.info('APP', `Received ${signal} signal. Shutting down gracefully...`);

    try {
        await connectionManager.destroy();
        server.close(() => {
            structuredLogger.info('APP', 'Server closed successfully');
            process.exit(0);
        });
    } catch (error) {
        structuredLogger.error('APP', 'Error during shutdown', error);
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', async (error) => {
    structuredLogger.error('APP', 'Uncaught exception', error);
    await connectionManager.destroy().catch(() => { });
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    structuredLogger.error('APP', 'Unhandled rejection', null, {
        reason: reason?.message || reason,
        promise: promise?.toString()
    });
    await connectionManager.destroy().catch(() => { });
    process.exit(1);
});