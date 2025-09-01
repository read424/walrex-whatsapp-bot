const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');
const Country = require('./country.model');

class Bank extends Model {}

Bank.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    sigla: {
        type: DataTypes.STRING(8),
        unique: true,
        allowNull: false
    },
    det_name: {
        type: DataTypes.STRING(80),
        unique: true,
        allowNull: false
    },
    codigo:  {
        type: DataTypes.STRING(5),
    },
    name_pay_binance: {
        type: DataTypes.STRING(50),
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
},{
    sequelize,
    modelName: 'Bank',
    tableName: 'banks',
    timestamps: false
});

Bank.belongsTo(Country, {
    as: 'bank',
    foreignKey: 'id_country',
    constraints: false,
    targetKey: 'id'
});

module.exports = Bank;