const { Model, DataTypes } = require('sequelize');
const sequelize = require("../infrastructure/config/DatabaseConfig");
const Currency = require("./currency.model");

class PriceExchange extends Model {
    // static associate(models){
    //     PriceExchange.belongsTo(models.Currency, {
    //         as: 'baseCurrency',
    //         foreignKey: 'id_currency_base',
    //         targetKey: 'id'
    //     });

    //     PriceExchange.belongsTo(models.Currency, {
    //         as: 'quoteCurrency',
    //         foreignKey: 'id_currency_quote',
    //         targetKey: 'id'
    //     });
    // }
}

PriceExchange.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    type_operation: {
        type: DataTypes.STRING(1),
        allowNull: false,
    },
    id_currency_base: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_currency_quote: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    amount_price: {
        type: DataTypes.NUMBER,
        allowNull: false
    },
    is_active: {
        type: DataTypes.STRING(1),
        defaultValue: '1',
        allowNull: false
    },
    date_exchange: {
        type: DataTypes.DATEONLY,
        allowNull: false
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
    modelName: 'PriceExchange',
    tableName: 'price_exchange',
    timestamps: false
});

PriceExchange.belongsTo(Currency, {
    as: 'baseCurrency',
    foreignKey: 'id_currency_base',
    constraints: false,
    targetKey: 'id'
});
PriceExchange.belongsTo(Currency, {
    as: 'quoteCurrency',
    foreignKey: 'id_currency_quote',
    constraints: false,
    targetKey: 'id'
});
module.exports = PriceExchange;