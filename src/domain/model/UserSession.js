const structuredLogger = require('../../infrastructure/config/StructuredLogger');
// Logger ya no necesario, usando structuredLogger directamente
const { cleanSetterLastName } = require("../../utils/index");

class UserSession {

    constructor(phoneNumber){
        this.phoneNumber = phoneNumber;
        this.session_id= null;
        this.message_id = null;
        this.stage = 'initial';
        this.data = {};
        this.currentMenu = null;
        this.menu = null;
    }

    isDataComplete(){
        return this.data.primer_apellido && this.data.segundo_apellido && this.data.firstName && this.data.dob && this.data.email;
    }

    nextStage(){
        switch (this.stage) {
            case 'initial':
                this.stage = 'collecting_lastName';
            break;
            case 'collecting_lastName':
                this.stage = 'collecting_firstName';
            break;
            case 'collecting_firstName':
                this.stage = 'collecting_dob';
            break;
            case 'collecting_dob':
                this.stage = 'collecting_email';
            break;
            case 'collecting_email':
                this.stage = 'completed';
            break;
            default:
                this.stage = 'completed';
            break;
        }        
    }

    saveDataForm(field, value, nextStage){
        this.data[field]=value;
        if(nextStage!=undefined)
            this.stage=nextStage;
    }

    saveData(field, value) {
        if(field==='firstLastName'){
            const { primer_apellido, segundo_apellido } = cleanSetterLastName(value);
            this.data['primer_apellido'] = primer_apellido;
            this.data['segundo_apellido'] = segundo_apellido;
        }else
            this.data[field] = value;
        this.nextStage();
    }

    setMenuOptions(menuOptions) {
        this.menu.options = {};
        menuOptions.forEach((option, index) => {
            this.menu.options[index + 1] = {id: option.id, arguments: option.arguments}; // Mapea números (1, 2, 3...) a IDs
        });
    }

    getOptionId(optionNumber) {
        return this.menu.options[optionNumber] || null;
    }
}

module.exports = UserSession;