const WhatsAppContextSingleton = require("../../../whatsappContextSingleton");
const { VenomStrategy, WhatsAppWebJsStrategy } = require("../../strategies");

class WhatsAppContextAdapter {

    constructor(selectedLibrary){
        this.selectedLibrary=selectedLibrary;
    }

    getWhatsAppContext(){
        let strategy;
        // Determinar la estrategia según la librería seleccionada
        if (this.selectedLibrary === "venom") {
            strategy = new VenomStrategy();
        } else if (this.selectedLibrary === "whatsapp-web.js") {
            strategy = new WhatsAppWebJsStrategy();
        } else {
            throw new Error("WhatsApp library not supported");
        }

        // Retornar la instancia del contexto de WhatsApp
        return WhatsAppContextSingleton.getInstance(strategy);        
    }
}

module.exports = WhatsAppContextAdapter;
