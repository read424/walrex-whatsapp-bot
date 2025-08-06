const { TraderCurrencyRepository } = require('../infrastructure/adapters/outbound')

class GetListCurrencyTraderUseCase {

    constructor(){
        this.traderCurrencyRepository = new TraderCurrencyRepository();
    }

    async getListPairTraderCurrency(){
        const list_traders = await this.traderCurrencyRepository.getListTraderCurrency();
        return list_traders;
    }
}

module.exports = GetListCurrencyTraderUseCase;