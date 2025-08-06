class CustomerServicePort {
    async create(customer, code_referral) {
        throw new Error('Method must be implemented');
    }

    async existsEmailUser(email) {
        throw new Error('Method must be implemented');
    }

    async searchUserByReferralCode(referralCode) {
        throw new Error('Method must be implemented');
    }

    async findByPhoneNumber(phoneNumber) {
        throw new Error('Method must be implemented');
    }
}

module.exports = CustomerServicePort; 