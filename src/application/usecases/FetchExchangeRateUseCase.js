class FetchExchangeRateUseCase {
    constructor(exchangeService, repository) {
        this.exchangeService = exchangeService; // Servicio para obtener datos externos
        this.repository = repository; // Repositorio para guardar datos
    }

    async execute(baseCurrency, quoteCurrency, amount) {
        const rate = await this.exchangeService.getPriceTradingPair("BUY", baseCurrency, quoteCurrency, amount);
        const exchangeRate = { base: quoteCurrency, rate, timestamp: new Date() };

        await this.repository.save(exchangeRate);
        return exchangeRate;
    }
}

module.exports = FetchExchangeRateUseCase;