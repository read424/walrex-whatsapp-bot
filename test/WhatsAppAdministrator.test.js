// Mock de los modelos de base de datos
const mockModels = {
    TradingCurrencies: {
        findAll: jest.fn()
    },
    Currency: {
        findAll: jest.fn()
    },
    BankTrade: {
        findAll: jest.fn()
    },
    Bank: {
        findAll: jest.fn()
    },
    Country: {
        findAll: jest.fn()
    },
    PriceExchange: {
        findAll: jest.fn()
    }
};

// Función helper para crear mocks de Sequelize
function createSequelizeMock(data) {
    return {
        ...data,
        toJSON: () => data
    };
}

// Mock del require de models desde WhatsAppAdministrator
jest.mock('../../../models', () => mockModels, { virtual: true });
jest.mock('../../models', () => mockModels, { virtual: true });
jest.mock('../models', () => mockModels, { virtual: true });

// Mock de StructuredLogger
jest.mock('../src/infrastructure/config/StructuredLogger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
}));

// Mock de TradingAdapter
const mockTradingAdapter = {
    getTradingPrice: jest.fn(),
    getTradePrice: jest.fn(),
    getExchangeRate: jest.fn()
};

// Mock de CustomerService
const mockCustomerService = {
    getCustomerByPhone: jest.fn(),
    getCustomerById: jest.fn()
};

describe('WhatsAppAdministrator', () => {
    let WhatsAppAdministrator;
    let whatsAppAdmin;
    let mockModels;

    // Definir mockTradingCurrencies en el scope correcto
    const mockTradingCurrencies = [
        {
            id: 1,
            id_currency_base: 4,
            id_currency_quote: 3,
            status: '1',
            id_company: 1,
            baseCurrency: {
                id: 4,
                code_iso3: 'PEN',
                name: 'Peru Nuevo Sol',
                id_country: 1,
                Country: { name_iso: 'PERU' }
            },
            quoteCurrency: {
                id: 3,
                code_iso3: 'VEF',
                name: 'Venezuela Bolivar',
                id_country: 2,
                Country: { name: 'VENEZUELA' }
            },
            baseCurrencyBanks: [
                {
                    id: 1,
                    sigla: 'BCP',
                    det_name: 'Banco Nacional de Crédito del Perú',
                    name_pay_binance: 'Credit Bank of Peru'
                },
                {
                    id: 2,
                    sigla: 'SCT',
                    det_name: 'Banco Scotiabank',
                    name_pay_binance: 'Scotiabank Peru'
                },
                {
                    id: 3,
                    sigla: 'ITBK',
                    det_name: 'Banco Interbank',
                    name_pay_binance: 'Interbank'
                },
                {
                    id: 4,
                    sigla: 'BBVA',
                    det_name: 'Banco BBVA',
                    name_pay_binance: 'BBVA Perú'
                }
            ],
            quoteCurrencyBanks: [
                {
                    id: 5,
                    sigla: 'BDV',
                    det_name: 'Banco de Venezuela',
                    name_pay_binance: 'Bank Transfer'
                },
                {
                    id: 9,
                    sigla: 'BANESC',
                    det_name: 'Banco Banesco',
                    name_pay_binance: 'Banesco'
                },
                {
                    id: 10,
                    sigla: 'MERCAN',
                    det_name: 'Banco Mercantil',
                    name_pay_binance: 'Mercantil'
                },
                {
                    id: 13,
                    sigla: 'PMOVI',
                    det_name: 'PAGO MOVIL',
                    name_pay_binance: 'Pago Movil'
                }

            ]
        }
    ];

    const mockBinanceRates = [
        {
            adv: {
                price: '1.0850',
                transAmount: '1000',
                transCryptoAmount: '0.5',
                advNo: '12345'
            },
            advertiser: {
                userNo: '67890',
                userType: 'merchant'
            }
        },
        {
            adv: {
                price: '1.0860',
                transAmount: '2000',
                transCryptoAmount: '1.0',
                advNo: '12346'
            },
            advertiser: {
                userNo: '67891',
                userType: 'merchant'
            }
        }
    ];

    beforeEach(() => {
        // Limpiar todos los mocks
        jest.clearAllMocks();
        
        // Importar la clase después de los mocks
        WhatsAppAdministrator = require('../src/application/WhatsAppAdministrator');
        
        // Crear instancia con mocks
        whatsAppAdmin = new WhatsAppAdministrator(mockCustomerService, mockTradingAdapter);
        
        // Mock del método sendMessage
        whatsAppAdmin.sendMessage = jest.fn();
        
        // Obtener referencia a los modelos mockeados
        mockModels = require('../models');
    });

    describe('handleTasaPrecioFromBinance', () => {
        const mockMessage = {
            from: '5511999999999@c.us',
            body: 'tasa_precio'
        };

        it('should successfully get trading currencies and Binance rates', async () => {
            // Configurar mocks con objetos Sequelize simulados
            const mockTradingCurrenciesSequelize = mockTradingCurrencies.map(tc => createSequelizeMock(tc));
            mockModels.TradingCurrencies.findAll.mockResolvedValue(mockTradingCurrenciesSequelize);
            
            const mockBankTradeBase = createSequelizeMock({
                Bank: createSequelizeMock({
                    id: 1,
                    sigla: 'BCP',
                    det_name: 'Banco Nacional de Crédito del Perú',
                    id_country: 1,
                    status: '1',
                    name_pay_binance: 'Credit Bank of Peru'
                })
            });
            
            const mockBankTradeQuote = createSequelizeMock({
                Bank: createSequelizeMock({
                    id: 5,
                    sigla: 'BDV',
                    det_name: 'Banco de Venezuela',
                    id_country: 2,
                    status: '1',
                    name_pay_binance: 'Bank Transfer'
                })
            });
            
            mockModels.BankTrade.findAll
                .mockResolvedValueOnce([mockBankTradeBase])
                .mockResolvedValueOnce([mockBankTradeQuote]);
            mockTradingAdapter.getExchangeRate.mockResolvedValue(1.0850);

            // Ejecutar método
            await whatsAppAdmin.handleTasaPrecioFromBinance(mockMessage);

            // Verificar que se llamó getTradingCurrencies
            expect(mockModels.TradingCurrencies.findAll).toHaveBeenCalledWith({
                where: { status: '1', id_company: 1 }, // idCompany hardcodeado para el test
                include: expect.arrayContaining([
                    expect.objectContaining({
                        model: mockModels.Currency,
                        as: 'baseCurrency',
                        attributes: ['code_iso3', 'name', 'id_country'],
                        include: [expect.objectContaining({
                            model: mockModels.Country,
                            as: 'Country',
                            attributes: ['name']
                        })]
                    }),
                    expect.objectContaining({
                        model: mockModels.Currency,
                        as: 'quoteCurrency',
                        attributes: ['code_iso3', 'name', 'id_country'],
                        include: [expect.objectContaining({
                            model: mockModels.Country,
                            as: 'Country',
                            attributes: ['name']
                        })]
                    })
                ]),
                order: [['id_currency_base', 'ASC'], ['id_currency_quote', 'ASC']]
            });

            // Verificar que se llamó getExchangeRate para cada par de monedas
            expect(mockTradingAdapter.getExchangeRate).toHaveBeenCalledWith('PEN', 'VEF');

            // Verificar que se envió el mensaje
            expect(whatsAppAdmin.sendMessage).toHaveBeenCalledWith(
                mockMessage.from,
                expect.stringContaining('🔄 *TASAS DESDE BINANCE*')
            );
        });

        it('should handle empty trading currencies gracefully', async () => {
            // Configurar mocks para retornar array vacío
            mockModels.TradingCurrencies.findAll.mockResolvedValue([]);

            // Ejecutar método
            await whatsAppAdmin.handleTasaPrecioFromBinance(mockMessage);

            // Verificar que se envió mensaje apropiado
            expect(whatsAppAdmin.sendMessage).toHaveBeenCalledWith(
                mockMessage.from,
                expect.stringContaining('No hay monedas configuradas para trading')
            );
        });

        it('should handle errors in getTradingCurrencies', async () => {
            // Configurar mock para lanzar error
            const mockError = new Error('Database connection failed');
            mockModels.TradingCurrencies.findAll.mockRejectedValue(mockError);

            // Ejecutar método
            await whatsAppAdmin.handleTasaPrecioFromBinance(mockMessage);

            // Verificar que se envió mensaje de error apropiado
            expect(whatsAppAdmin.sendMessage).toHaveBeenCalledWith(
                mockMessage.from,
                expect.stringContaining('❌ No hay monedas configuradas para trading')
            );
        });

        it('should handle errors in getExchangeRate', async () => {
            // Configurar mocks con objetos Sequelize simulados
            const mockTradingCurrenciesSequelize = mockTradingCurrencies.map(tc => createSequelizeMock(tc));
            mockModels.TradingCurrencies.findAll.mockResolvedValue(mockTradingCurrenciesSequelize);
            
            const mockBankTradeBase = createSequelizeMock({
                Bank: createSequelizeMock({
                    id: 1,
                    sigla: 'CHASE',
                    det_name: 'JP Morgan Chase',
                    codigo: 'CHASE001',
                    name_pay_binance: 'Chase Bank'
                })
            });
            
            const mockBankTradeQuote = createSequelizeMock({
                Bank: createSequelizeMock({
                    id: 2,
                    sigla: 'DEUTSCHE',
                    det_name: 'Deutsche Bank',
                    codigo: 'DEUT001',
                    name_pay_binance: 'Deutsche Bank'
                })
            });
            
            mockModels.BankTrade.findAll
                .mockResolvedValueOnce([mockBankTradeBase])
                .mockResolvedValueOnce([mockBankTradeQuote]);
            
            mockTradingAdapter.getExchangeRate.mockRejectedValue(new Error('Binance API error'));

            // Ejecutar método
            await whatsAppAdmin.handleTasaPrecioFromBinance(mockMessage);

            // Verificar que se envió mensaje de error apropiado
            expect(whatsAppAdmin.sendMessage).toHaveBeenCalledWith(
                mockMessage.from,
                expect.stringContaining('❌ No se pudieron obtener tasas desde Binance para las monedas configuradas')
            );
        });

        it('should format response correctly with multiple rates', async () => {
            try {
                // Configurar mocks con objetos Sequelize simulados
                const mockTradingCurrenciesSequelize = mockTradingCurrencies.map(tc => createSequelizeMock(tc));
                mockModels.TradingCurrencies.findAll.mockResolvedValue(mockTradingCurrenciesSequelize);
                
                const mockBankTradeBase = createSequelizeMock({
                    Bank: createSequelizeMock({
                        id: 1,
                        sigla: 'CHASE',
                        det_name: 'JP Morgan Chase',
                        codigo: 'CHASE001',
                        name_pay_binance: 'Chase Bank'
                    })
                });
                
                const mockBankTradeQuote = createSequelizeMock({
                    Bank: createSequelizeMock({
                        id: 2,
                        sigla: 'DEUTSCHE',
                        det_name: 'Deutsche Bank',
                        codigo: 'DEUT001',
                        name_pay_binance: 'Deutsche Bank'
                    })
                });
                
                mockModels.BankTrade.findAll
                    .mockResolvedValueOnce([mockBankTradeBase])
                    .mockResolvedValueOnce([mockBankTradeQuote]);
                mockTradingAdapter.getExchangeRate.mockResolvedValue(1.0850);

                // Debug: verificar que los mocks están configurados
                console.log('Mock configurado para TradingCurrencies:', mockModels.TradingCurrencies.findAll.mock.results);
                console.log('Mock configurado para BankTrade:', mockModels.BankTrade.findAll.mock.results);

                // Ejecutar método
                await whatsAppAdmin.handleTasaPrecioFromBinance(mockMessage);

                // Debug: ver qué mensajes se enviaron
                console.log('Mensajes enviados:', whatsAppAdmin.sendMessage.mock.calls);
                console.log('Número de mensajes:', whatsAppAdmin.sendMessage.mock.calls.length);

                // Verificar que el mensaje contiene información del rate
                const sentMessage = whatsAppAdmin.sendMessage.mock.calls[1][1]; // El segundo mensaje es la respuesta
                
                expect(sentMessage).toContain('PEN → VEF');
                expect(sentMessage).toContain('1.08500');
                expect(sentMessage).toContain('0.00%'); // Revenue por defecto
            } catch (error) {
                console.error('Error en test:', error);
                throw error;
            }
        });

        it('should handle missing bank information gracefully', async () => {
            // Configurar trading currencies sin información de bancos
            const tradingCurrenciesWithoutBanks = mockTradingCurrencies.map(tc => ({
                ...tc,
                baseCurrencyBanks: [],
                quoteCurrencyBanks: []
            }));
            
            const mockTradingCurrenciesSequelize = tradingCurrenciesWithoutBanks.map(tc => createSequelizeMock(tc));
            mockModels.TradingCurrencies.findAll.mockResolvedValue(mockTradingCurrenciesSequelize);
            
            // Mock de BankTrade.findAll retornando arrays vacíos
            mockModels.BankTrade.findAll
                .mockResolvedValueOnce([]) // Para baseCurrency
                .mockResolvedValueOnce([]); // Para quoteCurrency
            
            mockTradingAdapter.getExchangeRate.mockResolvedValue(1.0850);

            // Ejecutar método
            await whatsAppAdmin.handleTasaPrecioFromBinance(mockMessage);

            // Verificar que se envió el mensaje (sin errores)
            expect(whatsAppAdmin.sendMessage).toHaveBeenCalledWith(
                mockMessage.from,
                expect.stringContaining('🔄 *TASAS DESDE BINANCE*')
            );
        });
    });

    describe('getTradingCurrencies', () => {
        it('should fetch trading currencies with bank information', async () => {
            try {
                // Configurar mocks con objetos Sequelize simulados
                const mockTradingCurrenciesSequelize = mockTradingCurrencies.map(tc => createSequelizeMock(tc));
                mockModels.TradingCurrencies.findAll.mockResolvedValue(mockTradingCurrenciesSequelize);
                
                const mockBankTradeBase = createSequelizeMock({
                    Bank: createSequelizeMock({
                        id: 1,
                        sigla: 'CHASE',
                        det_name: 'JP Morgan Chase',
                        codigo: 'CHASE001',
                        name_pay_binance: 'Chase Bank'
                    })
                });
                
                const mockBankTradeQuote = createSequelizeMock({
                    Bank: createSequelizeMock({
                        id: 2,
                        sigla: 'DEUTSCHE',
                        det_name: 'Deutsche Bank',
                        codigo: 'DEUT001',
                        name_pay_binance: 'Deutsche Bank'
                    })
                });
                
                mockModels.BankTrade.findAll
                    .mockResolvedValueOnce([mockBankTradeBase])
                    .mockResolvedValueOnce([mockBankTradeQuote]);

                // Debug: verificar que los mocks están configurados
                console.log('Mock configurado para TradingCurrencies:', mockModels.TradingCurrencies.findAll.mock.results);
                console.log('Mock configurado para BankTrade:', mockModels.BankTrade.findAll.mock.results);

                // Ejecutar método
                const result = await whatsAppAdmin.getTradingCurrencies(1);

                // Debug: ver qué está retornando
                console.log('Result:', result);
                console.log('Result type:', typeof result);
                console.log('Result is null?', result === null);
                console.log('Mock calls TradingCurrencies:', mockModels.TradingCurrencies.findAll.mock.calls);
                console.log('Mock calls BankTrade:', mockModels.BankTrade.findAll.mock.calls);

                // Verificar resultado
                expect(result).toHaveLength(1);
                expect(result[0].baseCurrencyBanks).toHaveLength(1);
                expect(result[0].quoteCurrencyBanks).toHaveLength(1);
                expect(result[0].baseCurrencyBanks[0].name_pay_binance).toBe('Chase Bank');
                expect(result[0].quoteCurrencyBanks[0].name_pay_binance).toBe('Deutsche Bank');
            } catch (error) {
                console.error('Error en test:', error);
                throw error;
            }
        });
    });
});
