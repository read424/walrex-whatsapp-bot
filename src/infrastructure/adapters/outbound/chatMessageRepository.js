const { ChatMessage } = require('../../../models');
const { RESPONDER_TYPES } = require('../../../domain/constants/WhatsAppConstants');

class ChatMessageRepository {

    async addChatMessage(phoneNumber, message, chatSessionId){
        try{
            const chatMessage = await ChatMessage.create({
                phone_number: phoneNumber,
                message: message,
                chat_session_id: chatSessionId
            });
            return chatMessage;
        }catch(erro){
            throw erro;
        }
    }

    async addChatMessageResponse(phoneNumber, message, chatSessionId, response_by){
        try{
            const chatMessage = await ChatMessage.create({
                phone_number: phoneNumber,
                message: message,
                chat_session_id: chatSessionId,
                response_by: response_by,
                responder_type: (!response_by)? RESPONDER_TYPES.BOT : RESPONDER_TYPES.HUMAN
            });
            return chatMessage;
        }catch(erro){
            throw erro;
        }
    }

}

module.exports = ChatMessageRepository;