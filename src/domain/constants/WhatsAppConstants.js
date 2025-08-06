// WhatsApp Library Types
const WHATSAPP_LIBRARIES = {
    VENOM: 'venom',
    WHATSAPP_WEB_JS: 'whatsapp-web.js'
};

// Session Stages
const SESSION_STAGES = {
    INITIAL: 'initial',
    COLLECTING_LAST_NAME: 'collecting_lastName',
    COLLECTING_FIRST_NAME: 'collecting_firstName',
    COLLECTING_DOB: 'collecting_dob',
    COLLECTING_EMAIL: 'collecting_email',
    COMPLETED: 'completed'
};

// Menu Types
const MENU_TYPES = {
    MENU: 'menu',
    PROMPT: 'prompt',
    FORM: 'form'
};

// Message Types
const MESSAGE_TYPES = {
    DOCUMENT: 'document',
    IMAGE: 'image'
};

// Session Status
const SESSION_STATUS = {
    IS_LOGGED: 'isLogged',
    NOT_LOGGED: 'notLogged'
};

// Response Types
const RESPONDER_TYPES = {
    BOT: 'bot',
    HUMAN: 'human'
};

// Time Constants (in minutes)
const TIME_CONSTANTS = {
    SESSION_TIMEOUT_MINUTES: 10
};

// Phone Number Patterns
const PHONE_PATTERNS = {
    STATUS_BROADCAST: 'status@broadcast',
    GROUP_CHAT_SUFFIX: '@g.us',
    CUSTOMER_SUFFIX: '@c.us'
};

// Menu Options
const MENU_OPTIONS = {
    REMESAS: 1,
    ESTATUS_OPERACION: 2,
    RECLAMO: 3,
    TASAS: 4,
    CUENTAS_BANCARIAS: 5,
    CALCULADORA: 6,
    REGISTRARSE: 7,
    VOLVER: 0
};

// Form Stages
const FORM_STAGES = {
    AMOUNT_DEPOSIT: 'amount_deposit',
    IMAGE_DEPOSIT: 'image_deposit',
    ASSIGNED_BENEFICIARIO: 'assigned_beneficiario',
    NAME_BENEFICIARIO: 'name_beneficiario',
    APELLIDO_BENEFICIARIO: 'apellido_beneficiario',
    DNI_BENEFICIARIO: 'dni_beneficiario',
    ID_BANK: 'id_bank',
    COMPLETE: 'complete'
};

// Actions
const ACTIONS = {
    TRADING_CURRENCY: 'trading_currency',
    GET_LIST_BENEFICIARIOS: 'get_list_beneficiarios',
    GET_LIST_BANKS: 'get_list_banks',
    GET_INFO_OPERATION: 'getInfoOperation'
};

module.exports = {
    WHATSAPP_LIBRARIES,
    SESSION_STAGES,
    MENU_TYPES,
    MESSAGE_TYPES,
    SESSION_STATUS,
    RESPONDER_TYPES,
    TIME_CONSTANTS,
    PHONE_PATTERNS,
    MENU_OPTIONS,
    FORM_STAGES,
    ACTIONS
}; 