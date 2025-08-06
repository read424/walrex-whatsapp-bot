const structuredLogger = require('../../infrastructure/config/StructuredLogger');
const cacheManager = require('../../infrastructure/config/CacheManager');
const { MENU_TYPES, MENU_OPTIONS, ACTIONS } = require('../../domain/constants/WhatsAppConstants');

class MenuManager {
    constructor() {
        this.menus = null;
        this.initializeMenus();
    }

    /**
     * Inicializa todos los menús disponibles
     */
    initializeMenus() {
        const startTime = Date.now();
        
        // Intentar obtener del cache primero
        const cachedMenus = cacheManager.get('menus');
        if (cachedMenus) {
            this.menus = cachedMenus;
            structuredLogger.performance('MenuManager', 'initializeMenus_cache_hit', Date.now() - startTime);
            return;
        }

        // Si no está en cache, crear los menús
        this.menus = {
            mainMenu: {
                type: MENU_TYPES.MENU,
                text: `Hola! 👋 {$$name_client} soy Wali, bienvenido al asistente virtual de Walrex, estoy aquí para ayudarte a hacer más fácil tus operaciones.\nPor favor, selecciona una opción respondiendo con el número correspondiente:\n1.-Envio de Remesa 💸\n2.-Estatus Operación 📁\n3.-Reclamo 📝\n4.-Tasas\n5.-Nuestras Ctas Bancarias\n6.-Calculadora 🧮\n7.-Registrarse 👤\nPor ejemplo, escribe *1* para realizar una remesa.\nQue opción deseas elegir?`,
                options: {
                    [MENU_OPTIONS.REMESAS]: { 
                        type: MENU_TYPES.MENU, 
                        next: 'remesasMenu', 
                        action: ACTIONS.TRADING_CURRENCY
                    },
                    [MENU_OPTIONS.ESTATUS_OPERACION]: { 
                        text: `Ingresar N° Operación🔖\n`, 
                        search: ACTIONS.GET_INFO_OPERATION
                    },
                    [MENU_OPTIONS.RECLAMO]: { 
                        text: `1.-Nuevo Reclamo 📝\n2.-Consultar Reclamo 🔍\n`, 
                        next: 'reclamoMenu'
                    },
                    [MENU_OPTIONS.TASAS]: { 
                        text: `4.-Registrarse 👤\n`
                    },
                    [MENU_OPTIONS.CUENTAS_BANCARIAS]: { 
                        text: `1.-Enviar a: 📤\n2.- Recibir en: 📥`
                    }
                }
            },
            remesasMenu: {
                type: MENU_TYPES.PROMPT,
                text: `Su remesa será desde {$$from} hacia {$$to}\nEscriba 0 para volver al Menu Principal`,
                next: 'formRemesa',
                stage: 'initial',
                field: 'id_trader'
            },
            formRemesa: {
                type: MENU_TYPES.FORM,
                current_input: 1,
                input: {
                    '1': { 
                        text: `Indique la cantidad depositada`, 
                        field: 'amount', 
                        stage: 'amount_deposit'
                    },
                    '2': { 
                        next: 'menuBeneficiario', 
                        text: `Subir imagen del deposito y/o transferencia`, 
                        attach_image: true, 
                        field: 'img_deposit', 
                        stage: 'image_deposit'
                    }
                }
            },
            menuBeneficiario: {
                type: MENU_TYPES.MENU,
                text: `1.-Listar Beneficiarios\n2.-Otro Beneficiario\n0.-Volver al Menu Principal`,
                options: {
                    '1': { 
                        type: MENU_TYPES.MENU, 
                        next: 'finishRemesa', 
                        action: ACTIONS.GET_LIST_BENEFICIARIOS
                    },
                    '2': { 
                        next: 'formBeneficiario'
                    }
                }
            },
            finishRemesa: {
                type: MENU_TYPES.PROMPT,
                field: 'id_beneficiario',
                stage: 'assigned_beneficiario',
                text: `Gracias por preferirnos, en ⏱️ minutos le haremos llegar el 💵 a {$$beneficiario} y 📣 recibiras la confirmación de la operación`
            },
            formBeneficiario: {
                type: MENU_TYPES.FORM,
                current_input: 1,
                input: {
                    '1': { 
                        text: `Nombre(s) del Beneficiario`, 
                        field: 'name_beneficiario', 
                        stage: 'name_beneficiario'
                    },
                    '2': { 
                        text: `Apellido(s) del Beneficiario`, 
                        field: 'apellido_beneficiario', 
                        stage: 'apellido_beneficiario'
                    },
                    '3': { 
                        text: `Doc Identidad del Beneficiario`, 
                        field: 'dni_beneficiario', 
                        stage: 'dni_beneficiario'
                    },
                    '4': { 
                        action: ACTIONS.GET_LIST_BANKS, 
                        field: 'id_bank', 
                        stage: 'id_bank'
                    },
                    '5': { 
                        text: `Número de Cuenta`, 
                        field: 'number_account', 
                        stage: 'complete'
                    }
                }
            },
            reclamoMenu: {
                text: ``
            }
        };

        // Guardar en cache por 10 minutos
        cacheManager.set('menus', this.menus, 10 * 60 * 1000);
        
        structuredLogger.performance('MenuManager', 'initializeMenus_cache_miss', Date.now() - startTime, {
            menuCount: Object.keys(this.menus).length
        });
    }

    /**
     * Obtiene un menú específico
     * @param {string} menuName - Nombre del menú
     * @returns {Object} - Configuración del menú
     */
    getMenu(menuName) {
        const startTime = Date.now();
        
        // Intentar obtener del cache específico del menú
        const cacheKey = `menu_${menuName}`;
        const cachedMenu = cacheManager.get(cacheKey);
        
        if (cachedMenu) {
            structuredLogger.performance('MenuManager', 'getMenu_cache_hit', Date.now() - startTime, {
                menuName
            });
            return cachedMenu;
        }

        const menu = this.menus[menuName];
        
        if (menu) {
            // Cachear el menú individual por 5 minutos
            cacheManager.set(cacheKey, menu, 5 * 60 * 1000);
            
            structuredLogger.performance('MenuManager', 'getMenu_cache_miss', Date.now() - startTime, {
                menuName
            });
        }

        return menu;
    }

    /**
     * Obtiene todas las opciones válidas de un menú
     * @param {string} menuName - Nombre del menú
     * @returns {Array} - Array con las opciones válidas
     */
    getValidOptions(menuName) {
        const menu = this.menus[menuName];
        if (!menu || !menu.options) {
            return [];
        }
        return Object.keys(menu.options);
    }

    /**
     * Verifica si una opción es válida para un menú
     * @param {string} menuName - Nombre del menú
     * @param {string} option - Opción a verificar
     * @returns {boolean} - True si la opción es válida
     */
    isValidOption(menuName, option) {
        const validOptions = this.getValidOptions(menuName);
        return validOptions.includes(option);
    }

    /**
     * Obtiene la configuración de una opción específica
     * @param {string} menuName - Nombre del menú
     * @param {string} option - Opción seleccionada
     * @returns {Object} - Configuración de la opción
     */
    getOptionConfig(menuName, option) {
        const menu = this.menus[menuName];
        if (!menu || !menu.options) {
            return null;
        }
        return menu.options[option] || null;
    }

    /**
     * Asigna opciones dinámicas a un menú
     * @param {Object} session - Sesión del usuario
     * @param {Array} options - Lista de opciones dinámicas
     */
    assignDynamicOptions(session, options) {
        if (session.menu && session.menu.options) {
            session.menu.options = {};
            options.forEach((option, index) => {
                session.menu.options[index + 1] = {
                    id: option.id, 
                    arguments: option.arguments
                };
            });
        }
    }
}

module.exports = MenuManager; 