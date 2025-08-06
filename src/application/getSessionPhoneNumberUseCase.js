const { ChatSessionRepository } = require('../infrastructure/adapters/outbound');
const { normalizePhoneNumber } = require('../utils/index');
class GetSessionPhoneNumberUseCase {
    constructor(){
        this.chatSessionRepository = new ChatSessionRepository();
    }

    async getSession(phoneNumber){
        const sanitizedPhoneNumber = normalizePhoneNumber(phoneNumber);
        const session = await this.chatSessionRepository.getLatestChatToday(sanitizedPhoneNumber);
        return session;
    }
}

module.exports = GetSessionPhoneNumberUseCase;