/**
 * Configuración de menús del bot de WhatsApp
 * Esta es configuración pura (datos), sin lógica de negocio
 */

const MENUS = {
    mainMenu: {
        type: 'menu',
        text: `Hola! 👋 {$$name_client} soy Wali, bienvenido al asistente virtual de Walrex, estoy aquí para ayudarte a hacer más fácil tus operaciones.\nPor favor, selecciona una opción respondiendo con el número correspondiente:\n1.-Envio de Remesa 💸\n2.-Estatus Operación 📁\n3.-Reclamo 📝\n4.-Tasas\n5.-Nuestras Ctas Bancarias\n6.-Calculadora 🧮\n7.-Registrarse 👤\nPor favor selecciona una opción respondiendo con el número correspondiente:\nPor ejemplo, escribe *1* para realizar una remesa.\nQue opción deseas elegir?`,
        options: {
            '1': { type: `menu`, next: 'remesasMenu', action:'trading_currency'},
            '2': { text: `Ingresar N° Operación🔖\n`, search: 'getInfoOperation'},
            '3': { text: `1.-Nuevo Reclamo 📝\n2.-Consultar Reclamo 🔍\n`, next: 'reclamoMenu'},
            '4': { text: `4.-Registrarse 👤\n`},
            '5': { text: `1.-Enviar a: 📤\n2.- Recibir en: 📥`}
        }
    },
    remesasMenu: {
        type: 'prompt',
        text: `Su remesa será desde {$$from} hacia {$$to}\nEscriba 0 para volver al Menu Principal`,
        next: `formRemesa`,
        stage: 'initial',
        field: 'id_trader'
    },
    formRemesa: {
        type: 'form',
        current_input:1,
        input: {
            '1': { text: `Indique la cantidad depositada`, field: 'amount', stage:'amount_deposit'},
            '2': { next: 'menuBeneficiario', text: `Subir imagen del deposito y/o transferencia`, attach_image:true, field: 'img_deposit', stage: 'image_deposit'},
        }
    },
    menuBeneficiario:{
        type:'menu', text: `1.-Listar Beneficiarios\n2.-Otro Beneficiario\n0.-Volver al Menu Principal`,
        options: {
            '1': { type: `menu`, next: 'finishRemesa', action: 'get_list_beneficiarios'},
            '2': { next: 'formBeneficiario'},
        }
    },
    finishRemesa: {
        type: 'prompt',
        field: 'id_beneficiario',
        stage: 'assigned_beneficiario',
        text: `Gracias por preferirnos, en ⏱️ minutos le haremos llegar el 💵 a {$$beneficiario} y 📣 recibiras la confirmación de la operación `
    },
    formBeneficiario:{
        type: 'form',
        current_input: 1,
        input: {
            '1': { text: `Nombre(s) del Beneficiario`, field: 'name_beneficiario', stage: 'name_beneficiario'},
            '2': { text: `Apellido(s) del Beneficiario`, field: 'apellido_beneficiario', stage: 'apellido_beneficiario'},
            '3': { text: `Doc Identidad del Beneficiario`, field: 'dni_beneficiario', stage: 'dni_beneficiario'},
            '4': { action: `get_list_banks`, field: 'id_bank', stage: 'id_bank'},
            '5': { text: `Número de Cuenta`, field: 'number_account', stage:'complete'},
        }
    },
    reclamoMenu: {
        text: ``
    }
};

module.exports = { MENUS };