module.exports = {
    // Directorio de tests
    testMatch: ['**/test/**/*.test.js', '**/test/**/*.spec.js'],
    
    // Directorios a ignorar
    testPathIgnorePatterns: [
        '/node_modules/',
        '/logs/',
        '/tokens/',
        '/session-whatsappweb/'
    ],
    
    // Configuración de coverage
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/**/*.spec.js',
        '!src/infrastructure/logs/**',
        '!src/infrastructure/tokens/**',
        '!src/session-whatsappweb/**'
    ],
    
    // Directorio de coverage
    coverageDirectory: 'coverage',
    
    // Tipos de coverage
    coverageReporters: ['text', 'lcov', 'html'],
    
    // Configuración de entorno
    testEnvironment: 'node',
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
    
    // Timeout para tests
    testTimeout: 10000,
    
    // Verbose output
    verbose: true,
    
    // Clear mocks automáticamente
    clearMocks: true,
    
    // Restaurar mocks automáticamente
    restoreMocks: true,
    
    // Reset mocks automáticamente
    resetMocks: true
};
