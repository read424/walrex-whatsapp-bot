const { CustomerRepository } = require('../infrastructure/adapters/outbound');
const { normalizePhoneNumber } = require('../utils/index');

class CheckPhoneNumberUseCase {
    constructor(){
        this.customerRepository = new CustomerRepository();
    }

    async getCustomerForPhoneNumber(phoneNumber){
        const sanitizedPhoneNumber = normalizePhoneNumber(phoneNumber); 
        try{
            const customer = await this.customerRepository.findByPhoneNumber(sanitizedPhoneNumber);
            return customer;
        }catch(error){
            throw error;
        }
    }

    async existsPhoneNumber(phoneNumber){
        const customer = this.getCustomerForPhoneNumber(phoneNumber);
        return customer !== null;
    }

}

module.exports = CheckPhoneNumberUseCase;