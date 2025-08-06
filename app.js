const env = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: `.env.${env}`});
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const routes = require('./src/infrastructure/adapters/inbound/routes');
const structuredLogger = require('./src/infrastructure/config/StructuredLogger');
const correlationMiddleware = require('./src/infrastructure/adapters/inbound/middlewares/correlationMiddleware');
const { WhatsAppWebJsStrategy, VenomStrategy } = require('./src/infrastructure/adapters/inbound/');
const { WebSocketAdapter } = require('./src/infrastructure/adapters/inbound/');
const WhatsAppContextSingleton = require('./whatsappContextSingleton');

//inicializar express
const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // Permitir solicitudes de cualquier origen
app.use(bodyParser.json()); // Analizar solicitudes de contenido tipo application/json

// Servir archivos estáticos desde la carpeta public
app.use(express.static('public'));

// Middleware de correlation ID
app.use(correlationMiddleware);

// Crear servidor HTTP pero no iniciarlo aún
const server = require('http').createServer(app);
// Crear el adaptador WebSocket
const webSocketAdapter = new WebSocketAdapter(server); // URL del servidor WebSocket

const { WHATSAPP_LIBRARIES } = require('./src/domain/constants/WhatsAppConstants');

// Determinar estrategia
let strategy;
const selectedLibrary = process.env.WHATSAPP_LIBRARY;
structuredLogger.info('APP', 'Initializing WhatsApp strategy', {
    selectedLibrary,
    action: 'initialize_strategy'
});

if(selectedLibrary === WHATSAPP_LIBRARIES.VENOM){
    strategy = new VenomStrategy(webSocketAdapter);
}else if(selectedLibrary === WHATSAPP_LIBRARIES.WHATSAPP_WEB_JS){
    strategy = new WhatsAppWebJsStrategy(webSocketAdapter);
}else{
    structuredLogger.error('APP', 'Unsupported library', null, {
        selectedLibrary,
        action: 'initialize_strategy'
    });
    throw new Error('Library not supported' ); 
}

// Crear una instancia de WhatsAppContextSingleton
const whatsappContext = WhatsAppContextSingleton.getInstance(strategy);

app.use(async (req, res, next)=> {
    req.whatsappContext = whatsappContext;
    next();
});

// Cargar las rutas de la API
app.use('/api', routes);

//Initialize the client 
(async ()=> {
    try{
        structuredLogger.info('APP', 'Initializing WhatsApp context', {
            action: 'initialize_context'
        });
        await whatsappContext.init();
        structuredLogger.info('APP', 'WhatsApp context initialized successfully', {
            action: 'context_initialized'
        });
    }catch(error){
        structuredLogger.error('APP', 'Failed to initialize strategy', error, {
            action: 'initialize_context'
        });
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
process.on('SIGINT', () => {
    structuredLogger.info('APP', 'Received SIGINT signal. Closing server...', {
        action: 'shutdown_sigint'
    });
    server.close(() => {
        structuredLogger.info('APP', 'Server closed successfully', {
            action: 'server_closed'
        });
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    structuredLogger.info('APP', 'Received SIGTERM signal. Closing server...', {
        action: 'shutdown_sigterm'
    });
    server.close(() => {
        structuredLogger.info('APP', 'Server closed successfully', {
            action: 'server_closed'
        });
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    structuredLogger.error('APP', 'Uncaught exception', error, {
        action: 'uncaught_exception'
    });
    server.close(() => {
        process.exit(1);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    structuredLogger.error('APP', 'Unhandled rejection', null, {
        reason: reason?.message || reason,
        promise: promise?.toString(),
        action: 'unhandled_rejection'
    });
    server.close(() => {
        process.exit(1);
    });
});