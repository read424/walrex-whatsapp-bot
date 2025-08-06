class WhatsAppContext {

    constructor(strategy) {
        this.strategy = strategy;
    }

    setStrategy(strategy){
        this.strategy = strategy;
    }

    async init(){
        console.log(`Init Strategy: ${this.strategy.constructor.name}`);
        return await this.strategy.init();
    }

    async sendMessage(number, message){
        return await this.strategy.sendMessage(number, message);
    }

    async sendMessageMedia(number, message){
        return await this.strategy.sendMessageMedia(number, message);
    }

    async sendButtons(number, message, buttons, footer){
        return await this.strategy.sendButtons(number, message, buttons, footer);
    }

    async onMessage(callback){
        return await this.strategy.onMessage(callback);
    }
}

module.exports = WhatsAppContext;