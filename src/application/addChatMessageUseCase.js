const { ChatMessageRepository } = require('../infrastructure/adapters/outbound');

class AddChatMessageUseCase {

    constructor(){
        this.chatMessageRepository = new ChatMessageRepository();
    }

    async addChatMessage(phoneNumber, message, chatSessionId){
        try{
            const chatMessage = await this.chatMessageRepository.addChatMessage(phoneNumber, message, chatSessionId);
            return chatMessage;
        }catch(erro){
            throw erro;
        }
    }

    async addChatMessageResponse(phoneNumber, message, chatSessionId, response_by){
        try{
            const chatMessage = await this.chatMessageRepository.addChatMessageResponse(phoneNumber, message, chatSessionId, response_by);
            return chatMessage;
        }catch(erro){
            throw erro;
        }
    }

}

module.exports = AddChatMessageUseCase;