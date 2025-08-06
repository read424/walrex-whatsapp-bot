const structuredLogger = require('../../config/StructuredLogger');
// Logger ya no necesario, usando structuredLogger directamente
const sequelize  = require('../../config/DatabaseConfig');
const CustomerRepository = require('./customerRepository');
const UserRepository = require('./userRepository');
const { generatePassword } = require('../../../utils/util-string');

const CustomerServicePort = require('../../../application/ports/output/CustomerServicePort');

class CustomerService extends CustomerServicePort {
    
    constructor(){
        super(); // Llamar al constructor padre
        structuredLogger.info('CustomerService', 'Initializing customer service', {
            sequelize: !!sequelize,
            dirname: __dirname
        });
        this.customerRepository = new CustomerRepository();
        this.userRepository = new UserRepository();
        this.transaction = null;
    }

    async init_commit() {
        if(!this.transaction){
            this.transaction = await sequelize.transaction();
        }
    }

    async findByPhoneNumber(phoneNumber){
        return await this.customerRepository.findByPhoneNumber(phoneNumber);
    }

    async create(customer, code_referral){
        await this.init_commit();
        try{
            this.customerRepository.setTransaction(this.transaction);
            const row_customer = await this.customerRepository.create(customer, { transaction: this.transaction});
            this.userRepository.setTransaction(this.transaction);
            const user = await this.userRepository.create( {
                id_client: row_customer.id,
                username: customer.Email,
                password: await generatePassword('12345'),
                code_referral: code_referral,
                is_acstatustive: true
            });

            await this.userRepository.savedInviteReferral(user.id, customer.id_user_referal);
            
            await this.transaction.commit();
            return true;
        }catch(e){
            structuredLogger.error('CustomerService', 'Error creating customer', e, {
                customer: customer.Email,
                code_referral
            });
            await this.transaction.rollback();
        }
        return false;
    }

    async findByEmail(email){
        return await this.customerRepository.findByEmail(email);
    }

    async existsEmailUser(email){
        const customer = await this.findByEmail(email);
        return customer!==null;
    }

    async searchUserByReferralCode(referralCode){
        const row_user =  await this.userRepository.findByReferralCode(referralCode);
        return row_user;
    }
}

module.exports = CustomerService;