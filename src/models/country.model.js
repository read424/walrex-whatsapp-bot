const { Model, DataTypes } = require('sequelize');
const sequelize = require("../infrastructure/config/DatabaseConfig");

class Country extends Model {}

Country.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code_iso2: {
        type: DataTypes.STRING(2),
        allowNull: false,
        unique: true
    },
    code_iso3: {
        type: DataTypes.STRING(3),
        allowNull: false,
        unique: true
    },
    name_iso: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    code_phone_iso:{
        type: DataTypes.STRING(4),
        allowNull: false,
        unique: true
    },
    unicode_flag:{
        type: DataTypes.STRING(15),
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
    modelName: 'Country',
    tableName: 'country',
    timestamps: false
});

module.exports = Country;