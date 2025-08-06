const { User, Customer, InviteReferral } = require('../../../models');

class UserRepository {

    constructor(){
        this.transaction = null;
    }

    setTransaction(transaction){
        if(!this.transaction)
            this.transaction = transaction;
    }

    async create(user){
        return await User.create(user, { transaction: this.transaction });
    }

    async findByReferralCode(referralCode){
        return await User.findOne({ 
            where: { code_referral: referralCode }
        });
    }

    async savedInviteReferral(id_user, id_user_referral){
        return await InviteReferral.create({
            id_user: id_user,
            id_user_referral: id_user_referral
        }, { transaction: this.transaction });
    }
}

module.exports = UserRepository;