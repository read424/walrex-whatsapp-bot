const BinanceAPI = require("../binance.api");

class BinanceAPIAdapter {
    constructor() {
        this.api = new BinanceAPI();
    }

    async getPriceTradingPair(type, base, quote, amount) {
        return this.api.getPriceTradingPair(type, base, quote, amount);
    }
}

module.exports = BinanceAPIAdapter;