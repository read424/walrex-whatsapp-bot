const { Customer } = require('../../../models');

class CustomerRepository {
    constructor(){
        this.transaction = null;
    }

    setTransaction(transaction){
        if(!this.transaction)
            this.transaction = transaction;
    }

    async findByPhoneNumber(phoneNumber){
        return await Customer.findOne({ where: { phone_number: phoneNumber } });
    }

    async create(customer){
        return await Customer.create(customer, { transaction: this.transaction });
    }

    async findByEmail(email){
        return await Customer.findOne({ where: { det_email: email } });
    }

}

module.exports = CustomerRepository;