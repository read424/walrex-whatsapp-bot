const { BeneficiaryRepository } = require("../infrastructure/adapters/outbound");

class GetListBeneficiaryClientUseCase {
    constructor(){
        this.beneficiaryRepository = new BeneficiaryRepository();
    }

    async getListBeneficiaryToClient(id_client){
        const list_beneficiarios = await this.beneficiaryRepository.getListBeneficiaryClients(id_client);
        return list_beneficiarios;
    }
}

module.exports = GetListBeneficiaryClientUseCase;