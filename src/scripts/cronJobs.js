const cron = require("node-cron");
const BinanceAPIAdapter = require("../infrastructure/adapters/outbound/BinanceAPIAdapter");
const InMemoryRepository = require("../infrastructure/adapters/outbound/InMemoryRepository");
const FetchExchangeRateUseCase = require("../application/usecases/FetchExchangeRateUseCase");

const fetchAndStoreExchangeRates = async () => {
    try {
        const binanceService = new BinanceAPIAdapter();
        const repository = new InMemoryRepository();
        const fetchExchangeRateUseCase = new FetchExchangeRateUseCase(binanceService, repository);

        const result = await fetchExchangeRateUseCase.execute("USDT", "PEN", 10);
        console.log("Exchange rate fetched and stored:", result);
    } catch (error) {
        console.error("Error fetching exchange rate:", error);
    }
};

// Ejecutar cada 30 minutos
cron.schedule("*/30 * * * *", fetchAndStoreExchangeRates);

// Ejecución inicial
fetchAndStoreExchangeRates();