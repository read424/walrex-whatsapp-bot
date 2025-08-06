const cron = require("node-cron")
const BinanceAPI = require("../binance.api")
const { Client } = require("@elastic/elasticsearch")

const client = new Client({node: 'http://localhost:9200'})


const fetchAndStoreExchangeRates = async () => {
    try{
        const binanceAPI = new BinanceAPI();
        const response_price = await binanceAPI.getPriceTradingPair("BUY", "USDT", "PEN", 10);

        const doc = {
            timestamp: new Date(),
            base: "PEN",
            rate: response_price
        };

        await client.index({
            index: 'exchage_rates',
            body: doc
        });

    }catch(error){
        console.log(error)
    }
};

cron.schedule('*/30 * * * *', fetchAndStoreExchangeRates)

fetchAndStoreExchangeRates();