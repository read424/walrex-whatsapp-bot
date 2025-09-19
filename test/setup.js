// Setup global para Jest
// Este archivo se ejecuta antes de cada test

// Configurar variables de entorno para testing
process.env.NODE_ENV = 'test';

// Configurar console.log para que no interfiera con los tests
global.console = {
    ...console,
    // Silenciar logs durante los tests
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Configurar timeout global para tests
jest.setTimeout(10000);

// Mock global de fetch si es necesario
global.fetch = jest.fn();

// Configurar process.exit para evitar que los tests terminen la ejecución
process.exit = jest.fn();

// Configurar process.on para evitar warnings
process.on = jest.fn();

// Configurar process.env para testing
process.env.DB_DATABASE = 'walrex_db_test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USERNAME = 'test_user';
process.env.DB_PASSWORD = 'test_password';

// Configurar __dirname para tests
global.__dirname = __dirname;

// Configurar __filename para tests
global.__filename = __filename;
