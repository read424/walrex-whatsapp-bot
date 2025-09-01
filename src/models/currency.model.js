const { Model, DataTypes } = require('sequelize');
const sequelize = require("../infrastructure/config/DatabaseConfig");
const Country = require('./country.model');

class Currency extends Model {
    
}

Currency.init({
    id:{
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code_iso2: {
        type: DataTypes.STRING(2),
        allowNull: false,
        unique: true
    },
    code_iso3:{
        type: DataTypes.STRING(3),
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull:false,
        unique: true
    },
    id_country:{
        type: DataTypes.INTEGER,
        allowNull:false,
    },
    status:{
        type: DataTypes.STRING(1),
        allowNull: false,
        defaultValue: '1'
    },
    create_at:{
        type: DataTypes.DATE,
    },
    update_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'Currency',
    tableName: 'currencies',
    timestamps: false
});

Currency.belongsTo(Country, {
    foreignKey: 'id_country',
    as: 'Country',
    constraints: false,
    targetKey: 'id'
})
module.exports = Currency;