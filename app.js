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
app.use(bodyParser.json({ limit: '10mb' })); // Analizar solicitudes de contenido tipo application/json con límite de 10MB
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true })); // Para datos codificados en URL

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

// Sistema de monitoreo automático de WhatsApp
let monitoringInterval;
let isReconnecting = false;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const MONITORING_INTERVAL = 30000; // 30 segundos
const RECONNECT_COOLDOWN = 60000; // 1 minuto entre reconexiones

// Función para monitorear el estado de WhatsApp
async function monitorWhatsAppStatus() {
    if (isReconnecting) {
        structuredLogger.info('APP', 'Reconnection in progress, skipping monitoring', {
            action: 'monitor_skip_reconnecting'
        });
        return;
    }

    try {
        const status = whatsappContext.getClientStatus();
        
        if (!status.isLoggedIn) {
            consecutiveFailures++;
            structuredLogger.warn('APP', 'WhatsApp not authenticated', {
                consecutiveFailures,
                maxFailures: MAX_CONSECUTIVE_FAILURES,
                action: 'monitor_not_authenticated'
            });

            // Si hemos tenido varios fallos consecutivos, intentar reconectar
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                await attemptReconnection();
            }
        } else {
            // Resetear contador de fallos si está autenticado
            if (consecutiveFailures > 0) {
                structuredLogger.info('APP', 'WhatsApp authenticated successfully', {
                    previousFailures: consecutiveFailures,
                    action: 'monitor_authenticated'
                });
                consecutiveFailures = 0;
            }
        }
    } catch (error) {
        consecutiveFailures++;
        structuredLogger.error('APP', 'Error monitoring WhatsApp status', error, {
            consecutiveFailures,
            action: 'monitor_error'
        });

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            await attemptReconnection();
        }
    }
}

// Función para intentar reconectar WhatsApp
async function attemptReconnection() {
    if (isReconnecting) {
        structuredLogger.info('APP', 'Reconnection already in progress', {
            action: 'reconnect_already_in_progress'
        });
        return;
    }

    isReconnecting = true;
    structuredLogger.info('APP', 'Starting automatic WhatsApp reconnection', {
        consecutiveFailures,
        action: 'reconnect_start'
    });

    try {
        // Notificar por WebSocket que se va a reconectar
        webSocketAdapter.broadcast({
            type: 'whatsapp_reconnecting',
            message: 'WhatsApp se está reconectando automáticamente...',
            timestamp: new Date().toISOString()
        });

        // Intentar reconectar
        await whatsappContext.reconnect();
        
        structuredLogger.info('APP', 'WhatsApp reconnection completed successfully', {
            action: 'reconnect_success'
        });

        // Notificar por WebSocket que la reconexión fue exitosa
        webSocketAdapter.broadcast({
            type: 'whatsapp_reconnected',
            message: 'WhatsApp reconectado exitosamente',
            timestamp: new Date().toISOString()
        });

        // Resetear contador de fallos
        consecutiveFailures = 0;

    } catch (error) {
        structuredLogger.error('APP', 'WhatsApp reconnection failed', error, {
            action: 'reconnect_failed'
        });

        // Notificar por WebSocket que la reconexión falló
        webSocketAdapter.broadcast({
            type: 'whatsapp_reconnect_failed',
            message: 'Error al reconectar WhatsApp. Se intentará nuevamente en 1 minuto.',
            error: error.message,
            timestamp: new Date().toISOString()
        });

        // Esperar antes de permitir otra reconexión
        setTimeout(() => {
            isReconnecting = false;
        }, RECONNECT_COOLDOWN);

        return;
    }

    // Permitir reconexiones después de un tiempo
    setTimeout(() => {
        isReconnecting = false;
    }, RECONNECT_COOLDOWN);
}

// Función para iniciar el monitoreo
function startWhatsAppMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }

    structuredLogger.info('APP', 'Starting WhatsApp status monitoring', {
        interval: MONITORING_INTERVAL,
        maxFailures: MAX_CONSECUTIVE_FAILURES,
        action: 'monitoring_start'
    });

    monitoringInterval = setInterval(monitorWhatsAppStatus, MONITORING_INTERVAL);
}

// Función para detener el monitoreo
function stopWhatsAppMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        structuredLogger.info('APP', 'WhatsApp status monitoring stopped', {
            action: 'monitoring_stop'
        });
    }
}

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

        // Iniciar monitoreo automático después de la inicialización
        startWhatsAppMonitoring();

    }catch(error){
        structuredLogger.error('APP', 'Failed to initialize strategy', error, {
            action: 'initialize_context'
        });
        
        // Iniciar monitoreo incluso si falla la inicialización inicial
        startWhatsAppMonitoring();
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
    stopWhatsAppMonitoring();
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
    stopWhatsAppMonitoring();
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
    stopWhatsAppMonitoring();
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
    stopWhatsAppMonitoring();
    server.close(() => {
        process.exit(1);
    });
});