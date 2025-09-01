const { Model, DataTypes } = require('sequelize');
const sequelize = require("../infrastructure/config/DatabaseConfig");
const Currency = require('./currency.model');

class TradingCurrencies extends Model {
    
}

TradingCurrencies.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_company: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID de la empresa que configura el trading'
    },
    id_currency_base: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID de la moneda base para el trading'
    },
    id_currency_quote: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID de la moneda cotizada para el trading'
    },
    porc_revenue: {
        type: DataTypes.DECIMAL(6, 3),
        allowNull: false,
        comment: 'Porcentaje de ganancia/revenue para el trading'
    },
    status: {
        type: DataTypes.STRING(1),
        allowNull: false,
        defaultValue: '1',
        comment: 'Estado del registro: 1=Activo, 0=Inactivo'
    },
    create_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    update_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'TradingCurrencies',
    tableName: 'trading_currencies',
    timestamps: false
});

// Relaciones con Currency
TradingCurrencies.belongsTo(Currency, {
    foreignKey: 'id_currency_base',
    as: 'baseCurrency',
    constraints: false,
    targetKey: 'id'
});

TradingCurrencies.belongsTo(Currency, {
    foreignKey: 'id_currency_quote',
    as: 'quoteCurrency',
    constraints: false,
    targetKey: 'id'
});

module.exports = TradingCurrencies;
