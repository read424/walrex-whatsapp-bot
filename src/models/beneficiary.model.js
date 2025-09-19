const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');
const Bank = require('./bank.model')
const TypeAccountBank = require('./type_account_bank.model');

class Beneficiary extends Model {}

Beneficiary.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_client:{
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    id_bank: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_type_account: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    number_account: {
        type: DataTypes.STRING(25),
        allowNull: false,
        unique: true
    },
    last_name_benef: {
        type: DataTypes.STRING(60),
    },
    surname_benef: {
        type: DataTypes.STRING(50)
    },
    number_id:{
        type: DataTypes.STRING(15),
        allowNull: true,
        defaultValue: null
    },
    status:{
        type: DataTypes.STRING(1),
        defaultValue: '1'
    },
    create_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    update_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'Beneficiary',
    tableName: 'accounts_beneficiary',
    timestamps: false
});

Beneficiary.belongsTo(Bank, {
    as: 'bank',
    foreignKey: 'id_bank',
    constraints: false,
    targetKey: 'id'
});

Beneficiary.belongsTo(TypeAccountBank, {
    as: 'type_account',
    foreignKey: 'id_type_account',
    constraints: false,
    targetKey: 'id'
});

module.exports = Beneficiary;