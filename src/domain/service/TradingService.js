class TradingService {
    constructor(binanceAPI) {
        this.binanceAPI = binanceAPI;
    }

    async getOptimalPrice(typeTrade, currencyBase, currencyQuote, mountAccount, optionsTypePay) {
        const price = await this.binanceAPI.getPriceTradingPair(
            typeTrade,
            currencyBase,
            currencyQuote,
            mountAccount,
            optionsTypePay
        );

        // Aplica cualquier lógica adicional si es necesario
        return price;
    }
}
module.exports = TradingService;