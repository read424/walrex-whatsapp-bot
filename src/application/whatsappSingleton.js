
class WhatsappSingleton {
    
    static getInstance(strategy){
        if(!this.instance){
            this.instance = new WhatsAppContext(strategy);
        }
        return this.instance;
    }
}

module.exports = WhatsappSingleton;