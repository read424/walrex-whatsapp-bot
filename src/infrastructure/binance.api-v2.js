const env = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: `.env.${env}`});
const structuredLogger = require('./config/StructuredLogger');
const axios = require('axios');
const Bottleneck = require('bottleneck');
const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');
const sharp = require('sharp');
const { BinanceApiPort } = require('./adapters/outbound');

const limiter = new Bottleneck({
    minTime: 300,
    maxConcurrent: 2
});

class BinanceAPI extends BinanceApiPort {

    constructor(){
        super();
        this.requestQueue = [];
        this.isProcessing = false;
        this.consecutiveErrors = 0;
        this.lastRequestTime = 0;
        
        // Array de User-Agents realistas para rotación
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
        ];
        
        // Headers base más realistas
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Origin': 'https://p2p.binance.com',
            'Referer': 'https://p2p.binance.com/',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'DNT': '1',
            'X-Requested-With': 'XMLHttpRequest'
        };        
    }

    // Función para esperar con jitter aleatorio
    async randomDelay(baseMs = 2000, jitterMs = 1000) {
        const delay = baseMs + Math.random() * jitterMs;
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Función para calcular backoff exponencial
    getBackoffDelay(attempt) {
        // Reducir delays para testing
        const baseDelay = 500; // 0.5 segundos base (reducido de 1000)
        const maxDelay = 5000; // 5 segundos máximo (reducido de 30000)
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        return delay + Math.random() * 500; // Jitter reducido
    }
    
    // Procesador de cola de requests con rate limiting inteligente
    async processRequestQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.requestQueue.length > 0) {
            const { resolve, reject, requestFn } = this.requestQueue.shift();
            try {
                // Calcular tiempo desde última request
                const timeSinceLastRequest = Date.now() - this.lastRequestTime;
                const minInterval = this.consecutiveErrors > 0 ? 
                    this.getBackoffDelay(this.consecutiveErrors) : 
                    1000 + Math.random() * 1000; // 1-2 segundos con jitter (reducido)
                
                if (timeSinceLastRequest < minInterval) {
                    await this.randomDelay(minInterval - timeSinceLastRequest);
                }
                
                this.lastRequestTime = Date.now();
                const result = await requestFn();
                this.consecutiveErrors = 0; // Reset en caso de éxito
                resolve(result);
                
            } catch (error) {
                this.consecutiveErrors++;
                structuredLogger.error('BinanceAPI', `Request failed (attempt ${this.consecutiveErrors}):`, error.message);
                
                // Si es error 429 o similar, esperar más tiempo
                if (error.response?.status === 429 || error.code === 'ECONNRESET') {
                    await this.randomDelay(this.getBackoffDelay(this.consecutiveErrors));
                }
                
                reject(error);
            }
            
            // Delay adicional entre requests para evitar detección
            await this.randomDelay(500, 500); // Reducido para testing
        }
        
        this.isProcessing = false;
    }

    // Función para agregar requests a la cola
    async queueRequest(requestFn) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ resolve, reject, requestFn });
            this.processRequestQueue();
        });
    }

    async getPriceDolarParaleloVnzla(){
        try{
            await axios.get(`https://ve.dolarapi.com/v1/dolares/paralelo`,{
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then((response)=>{
                console.log(response);
            });
        }catch(error){

        }
    }
    
    async getTradingPairs(type_trade, currency_base, currency_quote, mount_account, options_type_pay, retryCount = 0) {
        const maxRetries = 3;

        const requestFn = async () => {
            try {
                // Agregar jitter al monto para evitar patrones
                const jitteredAmount = mount_account ? 
                    mount_account + Math.floor(Math.random() * 5) - 2 : 
                    mount_account;

                const data_search = {
                    "additionalKycVerifyFilter": 0,
                    "asset": currency_base,
                    "classifies": [ "mass", "profession", "fiat_trade"],
                    "countries": [],
                    "fiat": currency_quote,
                    "filterType": "all",
                    "page": 1,
                    "payTypes": options_type_pay || [],
                    "periods": [],
                    "proMerchantAds": false,
                    "publisherType": null,
                    "rows": 10,
                    "shieldMerchantAds": false,
                    "tradeType": type_trade || "BUY", 
                    ...(typeof jitteredAmount==='number'? {"transAmount": jitteredAmount}:{} )
                };

                // Usar headers dinámicos
                const config = {
                    headers: this.getDynamicHeaders(currency_quote),
                    timeout: currency_quote === 'USD' ? 20000 : 15000 // Timeout más largo para USD
                };
                                
                structuredLogger.info('BinanceAPI', `Consultando ${type_trade} ${currency_base}/${currency_quote} ${mount_account ? `(${mount_account})` : ''}`);

                const response = await axios.post(`https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search`, data_search, config);
                // Verificar si la respuesta es válida
                if (!response.data || !response.data.data) {
                    throw new Error('Respuesta inválida de la API');
                }

                // Log específico para USD para debugging
                if (currency_quote === 'USD') {
                    structuredLogger.info('BinanceAPI', `USD Response: ${response.data.data.length} results found`);
                    if (response.data.data.length === 0) {
                        structuredLogger.warn('BinanceAPI', 'USD query returned 0 results - trying alternative approach');
                        // Intentar con parámetros diferentes para USD
                        return await this.getUSDAlternative(type_trade, currency_base, currency_quote, mount_account, options_type_pay);
                    }
                }                

                return response.data;
            } catch (error) {
                if (retryCount < maxRetries && (
                    error.response?.status === 429 || 
                    error.code === 'ECONNRESET' ||
                    error.code === 'ETIMEDOUT' ||
                    (currency_quote === 'USD' && (!error.response?.data?.data || error.response.data.data.length === 0) && !error.message.includes('All USD alternative configurations failed'))
                )) {
                    structuredLogger.warn('BinanceAPI', `Retry ${retryCount + 1}/${maxRetries} for ${currency_quote} after error:`, error.message);
                    await this.randomDelay(this.getBackoffDelay(retryCount + 1));
                    return this.getTradingPairs(type_trade, currency_base, currency_quote, mount_account, options_type_pay, retryCount + 1);
                }
                throw error;                
            }    
        };
        return this.queueRequest(requestFn);
    }

    // Función de fallback para USD cuando la consulta principal falla
    async getUSDAlternative(type_trade, currency_base, currency_quote, mount_account, options_type_pay) {
        structuredLogger.info('BinanceAPI', 'Trying alternative USD query with different parameters...');
        
        // Intentar con diferentes configuraciones
        const alternativeConfigs = [
            {
                rows: 20,
                filterType: "all",
                additionalKycVerifyFilter: 1
            },
            {
                rows: 15,
                filterType: "all",
                additionalKycVerifyFilter: 0,
                proMerchantAds: true
            },
            {
                rows: 10,
                filterType: "all",
                additionalKycVerifyFilter: 0,
                shieldMerchantAds: true
            }
        ];

        for (const altConfig of alternativeConfigs) {
            try {
                await this.randomDelay(3000, 2000); // Esperar antes de intentar
                
                const data_search = {
                    "additionalKycVerifyFilter": altConfig.additionalKycVerifyFilter,
                    "asset": currency_base,
                    "classifies": [ "mass", "profession", "fiat_trade"],
                    "countries": [],
                    "fiat": currency_quote,
                    "filterType": altConfig.filterType,
                    "page": 1,
                    "payTypes": options_type_pay || [],
                    "periods": [],
                    "proMerchantAds": altConfig.proMerchantAds || false,
                    "publisherType": null,
                    "rows": altConfig.rows,
                    "shieldMerchantAds": altConfig.shieldMerchantAds || false,
                    "tradeType": type_trade || "BUY", 
                    ...(typeof mount_account==='number'? {"transAmount": mount_account}:{} )
                };

                const config = {
                    headers: this.getDynamicHeaders(currency_quote),
                    timeout: 25000
                };

                const response = await axios.post(`https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search`, data_search, config);
                
                if (response.data && response.data.data && response.data.data.length > 0) {
                    structuredLogger.info('BinanceAPI', `USD Alternative successful with config: ${JSON.stringify(altConfig)}`);
                    return response.data;
                }
            } catch (error) {
                structuredLogger.warn('BinanceAPI', `USD Alternative config failed: ${error.message}`);
                continue;
            }
        }
        
        throw new Error('All USD alternative configurations failed');
    }

    async getPriceTradingPair(type_trade, currency_base, currency_quote, mount_account, options_type_pay) {
        try {
            const price_publish = await this.getTradingPairs(type_trade, currency_base, currency_quote, null, options_type_pay || []).then((response)=>{
                return response.data.map((item)=>{
                    return {
                        "advNo": item.adv.advNo,
                        "classify": item.adv.classify,
                        "price": item.adv.price,
                        "minSingleTransAmount": item.adv.minSingleTransAmount,
                        "maxSingleTransAmount": item.adv.maxSingleTransAmount,
                        "payTimeLimit": item.adv.payTimeLimit,
                        "tradeMethods": item.adv.tradeMethods.map((method)=>{
                            return {
                                "tradeMethodShortName": method.tradeMethodShortName,
                                "tradeMethodName": method.tradeMethodName
                            }
                        }),
                        "nickName": item.advertiser.nickName,
                        "isTradable": item.adv.isTradable,
                        "privilegeDesc": item.adv.privilegeDesc
                    }
                }).filter((item) => {
                    return (item.isTradable===true && item.privilegeDesc ==null)
                }); 
            });
            if(!Array.isArray(price_publish) || price_publish.length==0){
                throw new Error(`No se encontraron informacion ${type_trade} ${currency_base} ${currency_quote} ${mount_account}`);
            }
            const first_price = parseFloat(price_publish[0].price);
            if(mount_account===null || mount_account===undefined){
                return first_price;
            }
            let amount_trade = 0;//
            if((currency_quote=="USD" || currency_quote=="EUR") && amount_trade<10){
                amount_trade = 9;
            }else{
                amount_trade = mount_account*first_price;
            }
            const price_get = await this.getTradingPairs(type_trade, currency_base, currency_quote, amount_trade, options_type_pay || []).then((response)=>{
                return response.data.map((item)=>{
                    return {
                        "advNo": item.adv.advNo,
                        "classify": item.adv.classify,
                        "price": item.adv.price,
                        "minSingleTransAmount": item.adv.minSingleTransAmount,
                        "maxSingleTransAmount": item.adv.maxSingleTransAmount,
                        "payTimeLimit": item.adv.payTimeLimit,
                        "tradeMethods": item.adv.tradeMethods.map((method)=>{
                            return {
                                "tradeMethodShortName": method.tradeMethodShortName,
                                "tradeMethodName": method.tradeMethodName
                            }
                        }),
                        "nickName": item.advertiser.nickName,
                        "isTradable": item.adv.isTradable
                    }
                }).filter((item) => {
                    return (item.isTradable===true)
                }); 
            });
            const price_trade = parseFloat(price_get[0].price);
            //logger.info(`${type_trade}/${currency_base} ${currency_quote}: [first_price: ${price_trade}] price trade: ${price_trade} mount: ${amount_trade}`);
            return {...price_publish[0], price_trading: price_trade, mount:amount_trade};
        } catch (error) {
            structuredLogger.error('BinanceAPI', `${type_trade} ${currency_base} ${currency_quote} ${mount_account} ${options_type_pay} : error ${error}`);
        }
    }

    // Función para obtener User-Agent aleatorio
    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    // Función para generar headers dinámicos
    getDynamicHeaders(currency_quote) {
        const baseHeaders = { ...this.defaultHeaders };
        baseHeaders['User-Agent'] = this.getRandomUserAgent();
        
        // Headers específicos para USD
        if (currency_quote === 'USD') {
            baseHeaders['Accept'] = 'application/json, text/plain, */*';
            baseHeaders['Cache-Control'] = 'no-cache';
            baseHeaders['Pragma'] = 'no-cache';
        }
        
        return baseHeaders;
    }


}
const delay = ms => new Promise(res => setTimeout(res, ms));

const binanceAPI = new BinanceAPI();

(async ()=> {    
    try{
        

        // Obtener la fecha y hora actual en formato YYYY-MM-DD_HHMMSS
        const date = new Date();
        const formattedDate = date.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/-/g, '').replace(/:/g, ''); // Formato "YYYYMMDD_HHMMSS"    
        // Ruta para guardar el archivo modificado
        const outputFilePath = path.join(__dirname, `./../img/state_${formattedDate}.jpeg`);

        const tasas=[
            //{
            //    USD_ECU:{ 
            //        country: 'Ecuador',
            //        trading: [
            //            {
            //                operation:"BUY", currency_base: 'USDT', currency_quote: 'USD', mount: 15, method_pay: ["BancoPichincha"]
            //            },
            //            {
            //                operation:"SELL", currency_base: 'USDT', currency_quote: 'USD', mount: 15, method_pay: ["BancoPichincha"]
            //            },
            //        ],
            //        exchange:[
            //           { class: 'big-font_ECU', to: 'VES', revenue: 7, fixed: 2, cashback: false},//5
            //        ]
            //    }
            //},
            { 
                USD_PEN:{ 
                    country: 'Perú',
                    trading: [
                        { operation:"BUY", currency_base: 'USDT',  currency_quote: 'USD',  mount: 20,  method_pay: ["CreditBankofPeru", "BancoDeCredito", "ScotiabankPeru", "Interbank"] },
                        { operation:"SELL", currency_base: 'USDT', currency_quote: 'USD', mount: 20, method_pay: ["CreditBankofPeru", "BancoDeCredito", "ScotiabankPeru", "Interbank"] },
                    ],
                    exchange:[
                        { to: 'VES', revenue: 5, fixed:3, cashback: false, mount_cashback: 1 },//4.58
                    ]
                }
            },
            { 
                PEN: { 
                    country: 'Perú',
                    trading: [
                        {
                            operation:"BUY", currency_base: 'USDT', currency_quote: 'PEN', mount: 200, 
                            method_pay: ["Yape", "Plin", "Ligo", "CreditBankofPeru", "BancoDeCredito", "Interbank", "ScotiabankPeru", "BBVABank", "BBVAPeru"]
                        },
                        {
                            operation:"SELL", currency_base: 'USDT', currency_quote: 'PEN', mount: 8, 
                            method_pay: ["Yape", "Plin", "Ligo", "CreditBankofPeru", "BancoDeCredito", "Interbank", "ScotiabankPeru", "BBVABank", "BBVAPeru"]
                        },
                    ],
                    exchange:[
                        { class: 'big-font_PE', to: 'VES', revenue: 4, fixed:3, cashback: false, mount_cashback: 1 },//4.5, 4
                        { to: 'CLP', revenue: 5.4, fixed:5, cashback: false },//5
                        { to: 'COP', revenue: 6.5, fixed:4, cashback: false },//5
                    ]
                }
            },
            { 
                VES: { 
                    country: 'Venezuela',
                    trading: [
                        {
                            operation:"BUY", currency_base: 'USDT', currency_quote: 'VES', mount: 10, method_pay: [ "Banesco", "PagoMovil", "SpecificBank", "BANK", "Mercantil"]
                        },
                        {
                            operation:"SELL", currency_base: 'USDT', currency_quote: 'VES', mount: 30, method_pay: [ "Banesco", "PagoMovil", "SpecificBank", "BANK", "Mercantil"]
                        }
                    ],
                    exchange:[
                        { to: 'PEN', revenue: 4.6, fixed: 3, cashback: false },//4.8
                        { to: 'COP', revenue: 5, fixed: 3, cashback: false },//4.5
                    ]
                }
            },
            //{
            //    COP:{
            //        country: 'Colombia',
            //        trading:[
            //            {
            //                operation:"BUY", currency_base: 'USDT', currency_quote: 'COP', mount:4, method_pay: [ "Nequi"]
            //            },
            //            {
            //                operation:"SELL", currency_base: 'USDT', currency_quote: 'COP', mount:4, method_pay: [ "Nequi"]
            //            }
            //        ],
            //        exchange:[
            //            { class: 'big-font_COP', to: 'VES', revenue: 6, fixed: 4, cashback: false },//5
            //            { class: 'COP_PE', to: 'PEN', revenue: 5, fixed: 5, cashback: false },//5
            //        ]
            //    }
            //},
            //{
            //    CLP:{
            //        country: 'Chile',
            //        trading:[
            //            {
            //                operation:"BUY", currency_base: 'USDT', currency_quote: 'CLP', mount: 8, method_pay: ["BancoFalabella","falabellachile","BancoEstado","ScotiabankChile"]
            //            },
            //            {
            //                operation:"SELL", currency_base: 'USDT', currency_quote: 'CLP', mount: 8, method_pay: ["BancoFalabella","falabellachile","BancoEstado","ScotiabankChile"]
            //            }
            //        ],
            //        exchange:[
            //            { class: 'big-font_CLP', to: 'VES', revenue: 6, fixed: 4, cashback: false },//4.5
            //            //{ class: 'big-font_CLP_COP', to: 'COP', revenue: 8, fixed: 3, cashback: false },
            //        ]
            //    }
            //},
        ];
        try{
            await binanceAPI.getTradingPairs("BUY", "USDT", "USD", 50, []);
        }catch(error_send){
            structuredLogger.error('BinanceAPI', `Error send message ${error_send}`);
        }
        structuredLogger.info('BinanceAPI', `Iniciando procesamiento de ${tasas.length} configuraciones de monedas`);
        
        const price_trading = await Promise.allSettled(
            tasas.map( async (item, index) =>{ 
                const key = Object.keys(item)[0]; // Obtener la clave (ej. 'PEN')
                const value = item[key]; // Obtener el contenido del objeto (trading, exchange, etc.)
                structuredLogger.info('BinanceAPI', `Procesando configuración ${index + 1}/${tasas.length}: ${key}`);
                const updateTrading = [];

                for(const [i, trade] of value.trading.entries()){

                    // Delay progresivo entre trades
                    if (i > 0) {
                        const delayTime = trade.currency_quote === 'USD' ? 2000 : 1000; // Reducido para testing
                        structuredLogger.info('BinanceAPI', `Esperando ${delayTime}ms antes del siguiente trade...`);
                        await delay(delayTime);
                    }
                    structuredLogger.info('BinanceAPI', `Procesando ${trade.operation} ${trade.currency_base}/${trade.currency_quote}...`);
                    const price_pair = await binanceAPI.getPriceTradingPair(
                        trade.operation,
                        trade.currency_base, 
                        trade.currency_quote, 
                        trade.mount, 
                        trade.method_pay || []
                    );
                    updateTrading.push({ ...trade, ...price_pair });
                    structuredLogger.info('BinanceAPI', `✓ Completado ${trade.operation} ${trade.currency_base}/${trade.currency_quote}`);
                }
                structuredLogger.info('BinanceAPI', `Configuración ${key} completada con ${updateTrading.length} trades`);
                return {
                    [key]:{
                        ...value,
                        trading: updateTrading
                    }
                }
                
            })
        );
        
        structuredLogger.info('BinanceAPI', `Procesamiento de todas las configuraciones completado. Iniciando cálculo de precios de exchange...`);
        
        // Filtrar solo las configuraciones exitosas
        const successfulConfigs = price_trading.filter(result => result.status === 'fulfilled').map(result => result.value);
        const failedConfigs = price_trading.filter(result => result.status === 'rejected');
        
        structuredLogger.info('BinanceAPI', `Configuraciones exitosas: ${successfulConfigs.length}/${tasas.length}`);
        if (failedConfigs.length > 0) {
            structuredLogger.warn('BinanceAPI', `Configuraciones fallidas: ${failedConfigs.length}`);
            failedConfigs.forEach((result, index) => {
                structuredLogger.error('BinanceAPI', `Configuración ${index + 1} falló:`, result.reason);
            });
        }
    
        var print_ve=0;
        const price_exchange = successfulConfigs.map( (item) =>{ 
            const key = Object.keys(item)[0]; // Obtener la clave (ej. 'PEN')
            const value = item[key]; // Obtener el contenido del objeto (trading, exchange, etc.)
            if (!value.exchange) {
                // Si no tiene exchange, devolver el objeto sin modificaciones
                return { [key]: value };
            }
            const frist_price= value.trading[0]?.price || 0;
            const price_buy = value.trading[0]?.price_trading || 0;
            const updatedExchange = value.exchange.map((exchangeItem)=>{
                // Buscar el objeto correspondiente en successfulConfigs usando exchangeItem.to
                const targetCurrency = successfulConfigs.find(obj => obj[exchangeItem.to]);
                if (!targetCurrency) return { ...exchangeItem, price_publish: 0, price_buy_sell: 0 };
                //venta / compra 
                if(exchangeItem.to=='VES' && print_ve==0){
                    console.log(`${JSON.stringify(targetCurrency)}`);
                    print_ve=1;
                }
                const first_price_sell = targetCurrency[exchangeItem.to]?.trading[1]?.price || 0; 
                const price_trading_sell = targetCurrency[exchangeItem.to]?.trading[1]?.price_trading || 0; 

                const price_buy_sell = (price_buy!=0)?price_trading_sell / price_buy:'-';
                var price_publish = (price_buy_sell!='-')?parseFloat(price_buy_sell/(1+(exchangeItem.revenue/100))).toFixed(exchangeItem.fixed):'-';
                var price_cashback = price_publish;
                if(exchangeItem.cashback){
                    price_cashback=parseFloat(price_publish*(1+(exchangeItem.mount_cashback/100))).toFixed(exchangeItem.fixed);
                }
                structuredLogger.info('BinanceAPI', `BUY ${key}: Frist Price: (${frist_price}) Price Trading: (${price_buy}) | SELL ${exchangeItem.to}: First Price: (${first_price_sell})  Price Trading: (${price_trading_sell})`)
                structuredLogger.info('BinanceAPI', `BUY ${key}: ${price_buy} / SELL ${exchangeItem.to}: ${price_trading_sell} (${price_buy_sell}) = Publicar ${key} / ${exchangeItem.to} ${exchangeItem.revenue} %: ${price_publish} cashback: ${price_cashback}`)
                return {
                    ...exchangeItem,
                    price_buy_sell: parseFloat(price_buy_sell).toFixed(exchangeItem.fixed),
                    price_publish: (price_publish!='-')?parseFloat(price_publish).toFixed(exchangeItem.fixed):'-',
                    price_cashback: parseFloat(price_cashback).toFixed(exchangeItem.fixed),
                }
            });
    
            return {
                [key]:{
                    ...value,
                    exchange: updatedExchange
                }
            }            
        });
        
        // Recorrer price_exchange para mapear los valores de price_publish
        const priceMap = {};
        price_exchange.forEach(item => {
            const key = Object.keys(item)[0]; // Extraer la clave (ej. 'USD_ECU')
            const value = item[key];
            if (value.exchange) {
                value.exchange.forEach(exchangeItem => {
                    if (exchangeItem.class) {
                        priceMap[exchangeItem.class] = exchangeItem.price_publish; // Guardar precio en el mapa
                    }
                });
            }
        });
        
        // Ruta del archivo SVG original
        const inputFilePath = './../img/last-design.svg';
        const fullInputPath = path.join(__dirname, inputFilePath);
        
        // Verificar si el archivo SVG existe
        try {
            await fs.access(fullInputPath);
            structuredLogger.info('BinanceAPI', `Archivo SVG encontrado: ${fullInputPath}`);
        } catch (error) {
            structuredLogger.error('BinanceAPI', `Archivo SVG no encontrado: ${fullInputPath}`, error);
            throw new Error(`El archivo SVG template no existe: ${fullInputPath}`);
        }

        const d3 = await import('d3');

        let data;
        try {
            data = await fs.readFile(fullInputPath, 'utf8');
            structuredLogger.info('BinanceAPI', `Archivo SVG leído correctamente (${data.length} caracteres)`);
        } catch (error) {
            structuredLogger.error('BinanceAPI', `Error al leer el archivo SVG: ${fullInputPath}`, error);
            throw new Error(`No se pudo leer el archivo SVG: ${error.message}`);
        }
        // Crear un entorno DOM usando jsdom
        let dom, document, svg;
        try {
            dom = new JSDOM(data);
            document = dom.window.document;
            
            // Verificar que el SVG existe en el documento
            const svgElement = document.querySelector('svg');
            if (!svgElement) {
                throw new Error('No se encontró el elemento SVG en el archivo');
            }
            
            // Usar D3 para seleccionar y modificar el SVG
            svg = d3.select(svgElement);
            structuredLogger.info('BinanceAPI', 'DOM creado y SVG seleccionado correctamente');
        } catch (error) {
            structuredLogger.error('BinanceAPI', 'Error al crear DOM o procesar SVG', error);
            throw new Error(`Error al procesar el SVG: ${error.message}`);
        }
        // Modificar el SVG, por ejemplo, cambiar el texto dentro de un elemento <tspan>
        svg.selectAll('tspan').each(function() {
            const tspan = d3.select(this);
            const className = tspan.attr('class'); // Obtener la clase del elemento
            if (className && priceMap[className]) {
                tspan.text(priceMap[className]); // Asignar el precio correspondiente
            }            
        });
        // Obtener la fecha actual para el nombre del archivo
        const currentDate = new Date();
        const currentDateStr = currentDate.toISOString().slice(0, 10).replace(/-/g, '');
        const currentTimeStr = currentDate.toTimeString().slice(0, 8).replace(/:/g, '');
        
        // Seleccionar el <tspan> con la clase "label_date"
        const tspan_date = svg.select('tspan.label_date');        
        // Verificar si el elemento fue encontrado
        if (!tspan_date.empty()) {
            // Formatear la fecha en el formato dd/MM/yyyy
            const formattedDate = currentDate.toLocaleDateString('es-PE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            // Asignar la fecha formateada al contenido del <tspan>
            tspan_date.text(formattedDate);
        } else {
            console.error('No se encontró el elemento <tspan> con la clase "label_date".');
        }
        // Obtener el contenido modificado del SVG como una cadena de texto
        let modifiedSvg, jpgBuffer;
        try {
            modifiedSvg = document.querySelector('svg').outerHTML;
            structuredLogger.info('BinanceAPI', `SVG modificado (${modifiedSvg.length} caracteres)`);
            
            // Usar sharp para convertir el SVG modificado a JPG con compresión
            jpgBuffer = await sharp(Buffer.from(modifiedSvg))
                .jpeg({ quality: 70, progressive: true }) // Comprimir con calidad 70%
                .toBuffer();
                
            structuredLogger.info('BinanceAPI', `Imagen convertida a JPG comprimida (${jpgBuffer.length} bytes)`);
        } catch (error) {
            structuredLogger.error('BinanceAPI', 'Error al convertir SVG a JPG', error);
            throw new Error(`Error en la conversión de imagen: ${error.message}`);
        }
            
        const jpgBase64 = jpgBuffer.toString('base64');

        // Guardar el archivo JPG
        try {
            await fs.writeFile(outputFilePath, jpgBuffer);
            structuredLogger.info('BinanceAPI', `Archivo JPG guardado: ${outputFilePath}`);
        } catch (error) {
            structuredLogger.error('BinanceAPI', `Error al guardar archivo JPG: ${outputFilePath}`, error);
            throw new Error(`No se pudo guardar la imagen: ${error.message}`);
        }

        // Crear el payload para enviar con el buffer
        const payload = {
            numberphone: '51935926562@c.us',
            imageBuffer: jpgBase64,
            mimeType: 'image/jpeg',
            filename: `state_${currentDateStr}_${currentTimeStr}.jpeg`
        };
        
                // Verificar estado de WhatsApp antes de enviar
        try {
            const statusResponse = await axios.get("http://localhost:3330/api/whatsapp-status", {
                timeout: 5000
            });

            if (!statusResponse.data.status.isLoggedIn) {
                structuredLogger.warn('BinanceAPI', 'WhatsApp no está autenticado. El servidor manejará la reconexión automáticamente.', {
                    status: statusResponse.data.status
                });
                structuredLogger.info('BinanceAPI', 'Imagen generada pero no enviada. El servidor WhatsApp se reconectará automáticamente.');
                return; // Salir sin error
            }
        } catch (statusError) {
            structuredLogger.warn('BinanceAPI', 'No se pudo verificar el estado de WhatsApp', statusError.message);
            structuredLogger.info('BinanceAPI', 'Imagen generada pero no enviada. Verifica el estado del servidor WhatsApp.');
            return; // Salir sin error
        }
        
        // Configurar la solicitud con axios
        try {
            const response = await axios.post("http://localhost:3330/api/send-message-media", payload, {
                headers: {
                    'Content-Type': 'application/json',
                },
                maxContentLength: 10000000,
                maxBodyLength: 10000000,
                timeout: 30000 // 30 segundos timeout
            });
            structuredLogger.info('BinanceAPI', `Mensaje enviado exitosamente: ${response.status}`);
        } catch (error) {
            structuredLogger.error('BinanceAPI', 'Error al enviar mensaje por WhatsApp', error);
            throw new Error(`Error en el envío de WhatsApp: ${error.message}`);
        }
    }catch (err) {
        structuredLogger.error('BinanceAPI', 'Error general durante el procesamiento', err);
        console.error("Error durante el procesamiento del archivo SVG:", err);
    }

})();

module.exports = BinanceAPI;