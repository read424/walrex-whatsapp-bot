const Customer = require('./customer.model');
const TypeDocumentId = require('./typedocument.model');
const Advisor = require('./advisor.model');
const ChatSession = require('./chatSession.model');
const ChatMessage = require('./chatMessage.model');
const User = require('./user.model');
const InviteReferral = require('./inviteReferral.model');
const Country = require('./country.model');
const PriceExchange = require('./priceExchange.model');
const Currency = require('./currency.model');
const Beneficiary = require("./beneficiary.model");
const Bank = require("./bank.model");
const TypeAccountBank = require('./type_account_bank.model');
const TradingCurrencies = require('./tradingCurrencies.model');
const UserType = require('./UserType.model');
const WhatsAppConnection = require('./WhatsAppConnection');
const Connection = require('./Connection.model');

module.exports = {
    Customer,
    TypeDocumentId,
    Advisor,
    ChatSession,
    ChatMessage,
    User,
    InviteReferral,
    Country,
    Currency,
    PriceExchange,
    Beneficiary,
    Bank,
    TypeAccountBank,
    TradingCurrencies,
    UserType,
    Connection,
    WhatsAppConnection
};