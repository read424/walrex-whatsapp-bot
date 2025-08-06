class MessageHandler {
    constructor(strategy) {
        this.strategy = strategy;
    }

    handleIncomingMessage(message) {
        this.strategy.handleIncomingMessage(message);
    }

    sendMessage(number, message) {
        
    }
}

module.exports = MessageHandler;