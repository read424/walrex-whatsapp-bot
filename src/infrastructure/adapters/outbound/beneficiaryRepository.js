const { Beneficiary, Bank, TypeAccountBank } = require('../../../models')

class BeneficiaryRepository {

    async getListBeneficiaryClients(id_cliente){
        try{
            const list_beneficiarios= await Beneficiary.findAll({
                include:[
                    {
                        model: Bank,
                        as: 'bank',
                        attributes: ['sigla', 'det_name', 'id_country'],
                        where: {status:'1'}
                    },
                    {
                        model: TypeAccountBank,
                        as: 'type_account',
                        attributes: ['det_name'],
                        where: {status:'1'}
                    }
                ],
                where: { id_client: id_cliente, status: '1' },
                attributes: [
                    'id', 'id_bank', 'id_type_account', 'number_account', 'last_name_benef', 'surname_benef', 'number_id'
                ]
            });
            if(!list_beneficiarios)
                return null;
            return list_beneficiarios;
        }catch(error){
            throw error;
        }
    }
}

module.exports = BeneficiaryRepository;