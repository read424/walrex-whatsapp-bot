const Customer = require('./customer.model');
const TypeDocumentId = require('./typedocument.model');
const Advisor = require('./advisor.model');
const ChatSession = require('./chatSession.model');
const ChatMessage = require('./chatMessage.model');
const Contact = require('./Contact.model');
const User = require('./user.model');
const InviteReferral = require('./inviteReferral.model');
const Country = require('./country.model');
const PriceExchange = require('./priceExchange.model');
const Currency = require('./currency.model');
const Beneficiary = require("./beneficiary.model");
const Bank = require("./bank.model");
const BankTrade = require("./bankTrade.model");
const TypeAccountBank = require('./type_account_bank.model');
const TradingCurrencies = require('./tradingCurrencies.model');
const UserType = require('./UserType.model');
const WhatsAppConnection = require('./WhatsAppConnection');
const Connection = require('./Connection.model');
const ChannelConnection = require('./ChannelConnection.model');

// Definir las relaciones entre modelos
const models = {
    Customer,
    TypeDocumentId,
    Advisor,
    ChatSession,
    ChatMessage,
    Contact,
    User,
    InviteReferral,
    Country,
    Currency,
    PriceExchange,
    Beneficiary,
    Bank,
    BankTrade,
    TypeAccountBank,
    TradingCurrencies,
    UserType,
    Connection,
    WhatsAppConnection,
    ChannelConnection,
};

// Establecer las asociaciones
Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

module.exports = models;