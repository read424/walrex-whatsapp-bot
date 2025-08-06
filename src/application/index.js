const WhatsAppBot = require('./whatsappBot');
const CheckPhoneNumberUseCase = require('./checkPhoneNumberUseCase');
const GetSessionPhoneNumberUseCase = require('./getSessionPhoneNumberUseCase');
const AddChatSessionUseCase = require('./addChatSessionUseCase');
const AddChatMessageUseCase = require('./addChatMessageUseCase');
const GetListCurrencyTraderUseCase = require('./getListCurrenyTraderUseCase');
const WhatsappSingleton = require('./whatsappSingleton');

module.exports = {
    WhatsAppBot,
    CheckPhoneNumberUseCase,
    GetSessionPhoneNumberUseCase,
    AddChatSessionUseCase,
    AddChatMessageUseCase,
    GetListCurrencyTraderUseCase,
    WhatsappSingleton
}