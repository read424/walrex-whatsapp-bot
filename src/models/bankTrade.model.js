const { Model, DataTypes } = require('sequelize');
const sequelize = require("../infrastructure/config/DatabaseConfig");
const Country = require('./country.model');
const Bank = require('./bank.model');

class BankTrade extends Model {
    
}

BankTrade.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_country: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_bank: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    status: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    id_user: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    create_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    update_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'BankTrade',
    tableName: 'banks_trade',
    timestamps: false
});

BankTrade.belongsTo(Country, {
    foreignKey: 'id_country',
    as: 'Country',
    constraints: false,
    targetKey: 'id'
});

BankTrade.belongsTo(Bank, {
    foreignKey: 'id_bank',
    as: 'Bank',
    constraints: false,
    targetKey: 'id'
});

module.exports = BankTrade; 