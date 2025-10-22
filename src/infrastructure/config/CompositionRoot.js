/**
 * Composition Root
 *
 * Este archivo es el único lugar donde se debe instanciar dependencias con "new".
 * Aquí se ensamblan todas las capas de la arquitectura hexagonal:
 * - Adaptadores de infraestructura
 * - Repositorios
 * - Servicios de dominio
 * - Casos de uso
 * - Controladores
 *
 * IMPORTANTE: Este archivo debe ser llamado UNA SOLA VEZ al iniciar la aplicación.
 */

const structuredLogger = require('./StructuredLogger');
const StructuredLoggerAdapter = require('../adapters/outbound/logging/StructuredLoggerAdapter');

// === CONTROLADORES ===
const AuthController = require('../adapters/inbound/rest/controller/AuthController');
const ChatController = require('../adapters/inbound/rest/controller/ChatController');
const TradingController = require('../adapters/inbound/rest/controller/TradingController');
const ConnectionController = require('../adapters/inbound/rest/controller/ConnectionController');
const PackageController = require('../adapters/inbound/rest/controller/PackageController');

// === CASOS DE USO ===
const AuthenticateUserUseCase = require('../../application/usecases/AuthenticateUserUseCase');
const CreateConnectionUseCase = require('../../application/usecases/CreateConnectionUseCase');
const UpdateConnectionUseCase = require('../../application/usecases/UpdateConnectionUseCase');
const GetConnectionsUseCase = require('../../application/usecases/GetConnectionsUseCase');
const RestartConnectionUseCase = require('../../application/usecases/RestartConnectionUseCase');
const RegisterPackageUseCase = require('../../application/usecases/RegisterPackageUseCase');
const GetActivePricesUseCase = require('../../application/usecases/GetActivePricesUseCase');
const GetTradingConfigUseCase = require('../../application/usecases/GetTradingConfigUseCase');

// Chat use cases
const GetActiveConversationsUseCase = require('../../application/usecases/GetActiveConversationsUseCase');
const GetChatSessionsUseCase = require('../../application/usecases/GetChatSessionsUseCase');
const GetChatMessagesUseCase = require('../../application/usecases/GetChatMessagesUseCase');
const GetConversationMessagesUseCase = require('../../application/usecases/GetConversationMessagesUseCase');
const SendChatMessageUseCase = require('../../application/usecases/SendChatMessageUseCase');
const UpdateChatSessionUseCase = require('../../application/usecases/UpdateChatSessionUseCase');
const ManageContactsUseCase = require('../../application/usecases/ManageContactsUseCase');

// === SERVICIOS DE DOMINIO ===
const AuthenticationService = require('../../domain/service/AuthenticationService');
const GetActiveConversationsService = require('../../domain/service/GetActiveConversationsService');

// === ADAPTADORES DE SALIDA / REPOSITORIOS ===
const UserRepositoryImpl = require('../adapters/outbound/persistence/UserRepositoryImpl');
const ConnectionRepositoryImpl = require('../adapters/outbound/persistence/ConnectionRepositoryImpl');
const PackageRepositoryImpl = require('../adapters/outbound/persistence/PackageRepositoryImpl');
const ChatMessageRepositoryImpl = require('../adapters/outbound/persistence/ChatMessageRepositoryImpl');
const ChatSessionRepositoryImpl = require('../adapters/outbound/persistence/ChatSessionRepositoryImpl');
const ConversationRepositoryImpl = require('../adapters/outbound/persistence/ConversationRepositoryImpl');
const ContactRepositoryImpl = require('../adapters/outbound/persistence/ContactRepositoryImpl');
const JwtTokenGeneratorAdapter = require('../adapters/outbound/security/JwtTokenGeneratorAdapter');
const BcryptPasswordHasherAdapter = require('../adapters/outbound/security/BcryptPasswordHasherAdapter');

// === RUTAS ===
const authRoutes = require('../adapters/inbound/rest/routes/auth');
const chatRoutes = require('../adapters/inbound/rest/routes/chat');
const inboxRoutes = require('../adapters/inbound/rest/routes/inbox');
const tradingRoutes = require('../adapters/inbound/rest/routes/trading');
const connectionsRoutes = require('../adapters/inbound/rest/routes/connections');
const packageRoutes = require('../adapters/inbound/rest/routes/packages');

/**
 * Configura e inyecta todas las dependencias
 */
function setupDependencies() {
    structuredLogger.info('CompositionRoot', 'Starting dependency injection setup');

    // === CREAR LOGGER ADAPTER ===
    const logger = new StructuredLoggerAdapter();

    // === CREAR REPOSITORIOS Y ADAPTADORES REALES ===
    const userRepository = new UserRepositoryImpl();
    const connectionRepository = new ConnectionRepositoryImpl();
    const packageRepository = new PackageRepositoryImpl();
    const chatMessageRepository = new ChatMessageRepositoryImpl();
    const chatSessionRepository = new ChatSessionRepositoryImpl();
    const conversationRepository = new ConversationRepositoryImpl();
    const contactRepository = new ContactRepositoryImpl();
    const tokenGenerator = new JwtTokenGeneratorAdapter();
    // BcryptPasswordHasherAdapter ahora requiere logger (segundo parámetro)
    const passwordHasher = new BcryptPasswordHasherAdapter(10, logger);

    structuredLogger.info('CompositionRoot', 'Repositories and adapters created', {
        userRepository: 'UserRepositoryImpl',
        connectionRepository: 'ConnectionRepositoryImpl',
        packageRepository: 'PackageRepositoryImpl',
        chatMessageRepository: 'ChatMessageRepositoryImpl',
        chatSessionRepository: 'ChatSessionRepositoryImpl',
        conversationRepository: 'ConversationRepositoryImpl',
        contactRepository: 'ContactRepositoryImpl',
        tokenGenerator: 'JwtTokenGeneratorAdapter',
        passwordHasher: 'BcryptPasswordHasherAdapter'
    });

    // === CREAR SERVICIOS DE DOMINIO ===
    const authenticationService = new AuthenticationService(
        userRepository,
        tokenGenerator,
        passwordHasher,
        logger
    );

    // === CREAR CASOS DE USO ===
    const authenticateUserUseCase = new AuthenticateUserUseCase(authenticationService);

    // Casos de uso de Connection
    const createConnectionUseCase = new CreateConnectionUseCase(connectionRepository, logger);
    const updateConnectionUseCase = new UpdateConnectionUseCase(connectionRepository, logger);
    const getConnectionsUseCase = new GetConnectionsUseCase(connectionRepository, logger);
    const restartConnectionUseCase = new RestartConnectionUseCase(connectionRepository, logger);

    // Casos de uso de Package
    const registerPackageUseCase = new RegisterPackageUseCase(packageRepository, logger);

    // Casos de uso de Chat
    // Crear servicio de dominio para conversaciones activas
    const getActiveConversationsService = new GetActiveConversationsService(conversationRepository, logger);
    const getActiveConversationsUseCase = new GetActiveConversationsUseCase(getActiveConversationsService);

    const getChatSessionsUseCase = new GetChatSessionsUseCase(chatSessionRepository, logger);
    const getChatMessagesUseCase = new GetChatMessagesUseCase(chatSessionRepository, chatMessageRepository, logger);
    const getConversationMessagesUseCase = new GetConversationMessagesUseCase(chatMessageRepository, conversationRepository, logger);

    // TODO: Estos use cases requieren adaptadores que se crean después (webSocketAdapter, connectionManager)
    // Por ahora los dejamos como null hasta que se refactorice el flujo de inicialización
    const sendChatMessageUseCase = null; // Requiere: chatSessionRepository, whatsAppConnectionPort, logger
    const updateChatSessionUseCase = null; // Requiere: chatSessionRepository, notificationPort, logger

    const manageContactsUseCase = new ManageContactsUseCase(contactRepository, logger);

    // TODO: Casos de uso de WhatsApp Admin (se instancian en WhatsAppAdministratorLegacy por ahora)
    // Cuando se refactorice whatsappWebJsStrategy.js, agregar aquí:
    // const getActivePricesUseCase = new GetActivePricesUseCase(tradingRepository, tradingAdapter, logger);
    // const getTradingConfigUseCase = new GetTradingConfigUseCase(tradingRepository, logger);

    // === CREAR CONTROLADORES ===
    const authController = new AuthController(authenticateUserUseCase, logger);

    const connectionController = new ConnectionController(
        createConnectionUseCase,
        updateConnectionUseCase,
        getConnectionsUseCase,
        restartConnectionUseCase,
        logger
    );

    const packageController = new PackageController(
        registerPackageUseCase,
        logger
    );

    const chatController = new ChatController({
        getActiveConversationsUseCase,
        getChatSessionsUseCase,
        getChatMessagesUseCase,
        getConversationMessagesUseCase,
        sendChatMessageUseCase,
        updateChatSessionUseCase,
        manageContactsUseCase,
        logger
    });

    // TODO: Crear los demás controladores cuando tengamos sus casos de uso
    // Por ahora los dejamos como null y mostrarán el mensaje de "no inicializado"
    const tradingController = null; // Pending

    // === INYECTAR CONTROLADORES EN RUTAS ===
    authRoutes.setAuthController(authController);
    connectionsRoutes.setConnectionController(connectionController);
    packageRoutes.setPackageController(packageController);

    // Inyectar ChatController en rutas de chat e inbox
    if (chatController) {
        if (chatRoutes.setChatController) {
            chatRoutes.setChatController(chatController);
        }
        if (inboxRoutes.setChatController) {
            inboxRoutes.setChatController(chatController);
        }
    }

    if (tradingController && tradingRoutes.setTradingController) {
        tradingRoutes.setTradingController(tradingController);
    }

    structuredLogger.info('CompositionRoot', 'Dependency injection setup completed', {
        controllers: {
            auth: !!authController,
            connections: !!connectionController,
            packages: !!packageController,
            chat: !!chatController,
            trading: !!tradingController
        }
    });
}

module.exports = { setupDependencies };