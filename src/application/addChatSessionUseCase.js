const { ChatSessionRepository } = require('../infrastructure/adapters/outbound');

class AddChatSessionUseCase {
    constructor(){
        this.chatSessionRepository = new ChatSessionRepository();
    }

    async addChatSession(phoneNumber){
        const chatSession = await this.chatSessionRepository.createChatSession(phoneNumber);
        return chatSession;
    }

    async updateChatSessionResponse(session_id){
        const chatSession = await this.chatSessionRepository.updateResponseChatSession(session_id);
        return chatSession;
    }

    async getEnabledSessionChat(phoneNumber){
        const chatSession = await this.chatSessionRepository.getSessionEnabled(phoneNumber);
        return chatSession;
    }
}

module.exports = AddChatSessionUseCase;