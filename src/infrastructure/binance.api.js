const env = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: `.env.${env}`});
const structuredLogger = require('./config/StructuredLogger');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');
const sharp = require('sharp');
const { BinanceAPIPort } = require('../ports');


class BinanceAPI extends BinanceAPIPort {

    async getTradingPairs(type_trade, currency_base, currency_quote, mount_account, options_type_pay) {
        try {
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
                "transAmount": mount_account || undefined
            };
            const response = await axios.post(`https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search`, data_search);
            return response.data;
        } catch (error) {
            throw error;
        }
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
                        "isTradable": item.adv.isTradable
                    }
                }).filter((item) => {
                    return (item.isTradable===true)
                }); 
            });
            const first_price = price_publish[0].price;
            if(mount_account===null || mount_account===undefined){
                return first_price;
            }
            let amount_buy = first_price*mount_account;
            if((currency_quote=="USD" || currency_quote=="EUR") && amount_buy<10){
                amount_buy = 10;
            }
            const price_get_buy = await this.getTradingPairs(type_trade, currency_base, currency_quote, amount_buy, options_type_pay || []).then((response)=>{
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

            const price_buy = price_get_buy[0].price;

            return price_buy;
            
            amount_buy = (price_buy*mount_account);
            if((currency_quote=="USD"  || currency_quote=="EUR") && amount_buy<10){
                amount_buy = 10;
            }

            const price_by_amount = await this.getTradingPairs(type_trade, currency_base, currency_quote, amount_buy, options_type_pay || []).then((response)=>{
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
                    }
                });
            });
            const price_found =price_by_amount.shift();
            return price_found.price;
        } catch (error) {
            logger.error(error);
        }
    }
}

const binanceAPI = new BinanceAPI();
(async ()=> {
    
    // Ruta del archivo SVG original
    const inputFilePath = './../img/last-design.svg';

    // Obtener la fecha y hora actual en formato YYYY-MM-DD_HHMMSS
    const date = new Date();
    const formattedDate = date.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/-/g, '').replace(/:/g, ''); // Formato "YYYYMMDD_HHMMSS"    
    // Ruta para guardar el archivo modificado
    const outputFilePath = path.join(__dirname, `./../img/state_${formattedDate}.jpeg`);
    //*
    //{ 
    // "PE": [{BUY: { asset: "USDT", fiat: "PEN", method_pay: [], mount:10}}, {SELL: { asset: "USDT", fiat: "PEN", method_pay: [], mount:10}}], 
    // "VE": [{BUY: { asset: "USDT", fiat: "VES", method_pay: ["Banesco", "PagoMovil", "SpecificBank", "BANK"], mount:10}}, {SELL: { asset: "USDT", fiat: "VES", method_pay: ["Banesco", "PagoMovil", "SpecificBank", "BANK"], mount:10}} ],
    // "COP": [{BUY: { asset: "USDT", fiat: "COP", method_pay: ["Nequi"], mount:10}}, {SELL: { asset: "USDT", fiat: "COP", method_pay: ["Nequi"], mount:10}} ]
    //}
    // */
    //venta de USDT con VES
    const tradingPairSELLVES = await binanceAPI.getPriceTradingPair("SELL", "USDT", "VES", 10, [ "Banesco", "PagoMovil", "SpecificBank", "BANK"]);

    //compra de USDT con USD
    const tradingPairBUYUSD = await binanceAPI.getPriceTradingPair("BUY", "USDT", "USD", 280, ["CreditBankofPeru", "ScotiabankPeru"]);
    //tasa de cambio de USD a VES - PRECIO COSTO
    const price_venta_USD_VES = tradingPairSELLVES/tradingPairBUYUSD;
    //precio publicar PEN a VES
    const price_publish_usd_ve = new Number(price_venta_USD_VES.toFixed(3)/1.04).toFixed(3);  
    logger.info(`BUY USD: ${tradingPairBUYUSD}/SELL VES: ${tradingPairSELLVES} (${price_venta_USD_VES}) = Publicar USD / VES 4.0%: ${price_publish_usd_ve}`);

    //compra de USDT con PEN
    const tradingPairBUYPE = await binanceAPI.getPriceTradingPair("BUY", "USDT", "PEN", 10);

    //tasa de cambio de PEN a VES - PRECIO COSTO
    const price_venta_PE_VES = tradingPairSELLVES/tradingPairBUYPE;
    //precio publicar PEN a VES
    const price_publish_pe_ve = new Number(price_venta_PE_VES.toFixed(3)/1.0458).toFixed(3);  
    logger.info(`BUY PEN: ${tradingPairBUYPE}/SELL VES: ${tradingPairSELLVES} (${price_venta_PE_VES}) = Publicar PEN / VES 4%: ${price_publish_pe_ve}`);

    //compra de USDT con VES
    const tradingPairBUYVES = await binanceAPI.getPriceTradingPair("BUY", "USDT", "VES", 10, [ "Banesco", "PagoMovil", "SpecificBank", "BANK"]);

    //venta de USDT con PEN
    const tradingPairSELLPE = await binanceAPI.getPriceTradingPair("SELL", "USDT", "PEN", 5);
    //tasa de cambio de VES a PEN - PRECIO COSTO
    const price_venta_VES_PE = tradingPairSELLPE/tradingPairBUYVES;
    //precio publicar VES a PEN
    const price_publish_VES_PE = new Number(price_venta_VES_PE.toFixed(4)/1.05).toFixed(4);
    logger.info(`BUY VES: ${tradingPairBUYVES} / SELL PEN: ${tradingPairSELLPE} (${price_venta_VES_PE}) = Publicar VES / PEN 5 %: ${price_publish_VES_PE}`);

    //compra de USDT con COP
    const tradingPairBUYCOP = await binanceAPI.getPriceTradingPair("BUY", "USDT", "COP", 5, ["Nequi"]);
    //tasa de cambio de COP a VES
    const price_venta_COP_VE = tradingPairSELLVES/tradingPairBUYCOP;
    //precio publicar COP a VES
    const price_publish_COP_VE = new Number(price_venta_COP_VE.toFixed(4)/1.05).toFixed(4);
    logger.info(`BUY COP: ${tradingPairBUYCOP} / SELL VES: ${tradingPairSELLVES} (${price_venta_COP_VE}) = Publicar COP / VES 4.5%: ${price_publish_COP_VE}`);

    //venta de USDT con COP
    const tradingPairSELLCOP = await binanceAPI.getPriceTradingPair("SELL", "USDT", "COP", 10, ["Nequi"]);
    //tasa de cambio de PE a COP
    const price_venta_PE_COP = tradingPairSELLCOP/tradingPairBUYPE;
    //precio publicar PE a COP
    const price_publish_PE_COP = new Number(price_venta_PE_COP.toFixed(5)/1.05).toFixed(5);
    logger.info(`BUY PE: ${tradingPairBUYPE} / SELL COP ${tradingPairSELLCOP} (${price_venta_PE_COP}) = Publicar PE / COP 5% : ${price_publish_PE_COP}`);

    //tasa de cambio de COP a PE
    const price_venta_COP_PE = tradingPairSELLPE/tradingPairBUYCOP;
    //precio publicar PE a COP
    const price_publish_COP_PE = new Number(price_venta_COP_PE.toFixed(5)/1.05).toFixed(5);
    logger.info(`BUY COP: ${tradingPairBUYCOP} / SELL PE: ${tradingPairSELLPE} (${price_venta_COP_PE} = Publicar COP / PE 5%: ${price_publish_COP_PE}`);

    
    //compra de USDT con CLP
    const tradingPairBUYCLP = await binanceAPI.getPriceTradingPair("BUY", "USDT", "CLP", 10, ["BancoFalabella","falabellachile","BancoEstado","ScotiabankChile"]);
    //tasa de cambio de CLP a VES
    const price_venta_CLP_VES = tradingPairSELLVES/tradingPairBUYCLP;
    //precio publicar PE a COP
    const price_publish_CLP_VES = new Number(price_venta_CLP_VES.toFixed(5)/1.05).toFixed(5);

    logger.info(`BUY CLP: ${tradingPairBUYCLP} / SELL VES ${tradingPairSELLVES} (${price_venta_CLP_VES}) = Publicar CLP / VES 5% : ${price_publish_CLP_VES}`);

    //vender de USDT con USD / Ecuador
    const tradingPairSELLUSD = await binanceAPI.getPriceTradingPair("SELL", "USDT", "USD", 10, ["BancoPichincha", "BancoGuayaquil"]);
    //tasa de cambio de VES a USD (ECUADOR)
    const price_venta_VES_USD = tradingPairSELLUSD/tradingPairBUYVES;
    //precio publicar VES a USD (ECUADOR)
    const price_publish_VES_USD = new Number(price_venta_VES_USD.toFixed(5)/1.05).toFixed(5);

    logger.info(`BUY VES: ${tradingPairBUYVES} / SELL USD ${tradingPairSELLUSD} (${price_venta_VES_USD}) = Publicar VES / USD 5% : ${price_publish_VES_USD}`);


    //comprar de USDT con Euro
    const tradingPairBUYEUR = await binanceAPI.getPriceTradingPair("SELL", "USDT", "EUR", 10, ["BBVABank", "Bizum"]);
    //tasa de cambio de EUR a PEN
    const price_compra_PEN_EUR = tradingPairSELLPE/tradingPairBUYEUR;
    //precio publicar EUR a PEN 
    const price_publish_PEN_EUR = new Number(price_compra_PEN_EUR.toFixed(5)/1.05).toFixed(5);

    logger.info(`BUY EUR: ${tradingPairBUYEUR} / SELL PEN ${tradingPairSELLPE} (${price_compra_PEN_EUR}) = Publicar EUR / PEN 5% : ${price_publish_PEN_EUR}`);

    //venta de USDT a CLP
    const tradingPairSELLCLP = await binanceAPI.getPriceTradingPair("SELL", "USDT", "CLP", 10, ["BancoFalabella","falabellachile","BancoEstado","ScotiabankChile"]);
    //tasa de cambio de EUR a CLP
    const price_compra_EUR_CLP = tradingPairSELLCLP/tradingPairBUYEUR;
    //precio publicar EUR a CLP
    const price_publish_PEN_CLP = new Number(price_compra_EUR_CLP.toFixed(5)/1.05).toFixed(5);
    logger.info(`BUY EUR: ${tradingPairBUYEUR} / SELL CLP ${tradingPairSELLCLP} (${price_compra_EUR_CLP}) = Publicar EUR / CLP 5% : ${price_publish_PEN_CLP}`);
    //compra de USDT con USD
    const tradingPairBUYUSD_ECU = await binanceAPI.getPriceTradingPair("BUY", "USDT", "USD", 10, ["BancoPichincha"]);
    //tasa de cambio de USD (ECU) a VES
    const price_compra_USD_ECU_VEN = tradingPairSELLVES/tradingPairBUYUSD_ECU;
    //precio publicar USD-ECU a VES
    const price_publish_USDECU_VES = new Number(price_compra_USD_ECU_VEN.toFixed(3)/1.048).toFixed(2);
    logger.info(`BUY USD/ECU: ${tradingPairBUYUSD_ECU} / SELL VES ${tradingPairSELLVES} (${price_compra_USD_ECU_VEN}) = Publicar USD-ECU / VES 4.8% : ${price_publish_USDECU_VES}`);

    const d3 = await import('d3');
    try{
        const data = await fs.readFile(path.join(__dirname, inputFilePath), 'utf8');
        // Crear un entorno DOM usando jsdom
        const dom = new JSDOM(data);
        const document = dom.window.document;
        // Usar D3 para seleccionar y modificar el SVG
        const svg = d3.select(document.querySelector('svg'));
        // Modificar el SVG, por ejemplo, cambiar el texto dentro de un elemento <tspan>
        svg.selectAll('tspan')
            .each(function() {
                const tspan = d3.select(this);
                if (tspan.classed('big-font_COP')) {
                    tspan.text(price_publish_COP_VE); // Cambiar el texto
                }
                if (tspan.classed('big-font_PE')) {
                    tspan.text(price_publish_pe_ve); // Cambiar el texto
                }
                if (tspan.classed('big-font_ECU')) {
                    tspan.text(price_publish_USDECU_VES); // Cambiar el texto
                }
                if (tspan.classed('big-font_CLP')) {
                    tspan.text(price_publish_CLP_VES); // Cambiar el texto
                }
            });
    
        // Obtener el contenido modificado del SVG como una cadena de texto
        const modifiedSvg = document.querySelector('svg').outerHTML;
        // Usar sharp para convertir el SVG modificado a JPG
        const jpgBuffer = await sharp(Buffer.from(modifiedSvg))  // Tomamos el SVG modificado como un buffer
            .jpeg()  // Convertirlo a formato JPG
            .toFile(outputFilePath, async (err, info) => {
                if (err) {
                    console.error("Error al convertir el SVG a JPG:", err);
                } else {
                    console.log("Imagen convertida y guardada como JPG:", info);
                }
            }).toBuffer();
            
        const jpgBase64 = jpgBuffer.toString('base64');

        // Crear el payload para enviar
        const payload = {
            numberphone: '51935926562@c.us',
            imageBuffer: jpgBase64,
            mimeType: 'image/jpeg',
            filename: 'price_chart.jpg'
        };
        // Configurar la solicitud con axios
        const response = await axios.post("http://localhost:3330/api/send-message-media", payload, {
            headers: {
                'Content-Type': 'application/json',
            },
            maxContentLength: 10000000,
            maxBodyLength: 10000000,
        });
    }catch (err) {
        console.error("Error durante el procesamiento del archivo SVG:", err);
    }

})();

module.exports = BinanceAPI;