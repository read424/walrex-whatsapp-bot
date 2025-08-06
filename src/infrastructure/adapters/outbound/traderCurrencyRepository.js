const { PriceExchange, Currency, Country } = require('../../../models');

class TraderCurrencyRepository {
    
    async getListTraderCurrency(){
        try{
            const list_exchanges = await PriceExchange.findAll({
                include:[
                    {
                        model: Currency,
                        as: 'baseCurrency',
                        attributes: ['code_iso3', 'name'],
                        include:[
                            {
                                model: Country,
                                as: 'Country',
                                attributes: ['unicode_flag', 'name_iso']
                            }
                        ]
                    },
                    {
                        model: Currency,
                        as: 'quoteCurrency',
                        attributes: ['code_iso3', 'name'],
                        include:[
                            {
                                model: Country,
                                as: 'Country',
                                attributes: ['unicode_flag', 'name_iso']
                            }
                        ]                        
                    }
                ],
                where: { is_active: '1' },
                attributes: ['id', 'type_operation', 'mount_price', 'date_exchange'],
                order: [['date_exchange', 'DESC']]
            });
            if(!list_exchanges)
                return null;
            return list_exchanges;
        }catch(error){
            throw error;
        }
    }
}

module.exports = TraderCurrencyRepository;