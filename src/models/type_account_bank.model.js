const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');

class TypeAccountBank extends Model {}

TypeAccountBank.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    det_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
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
    modelName: 'TypeAccountBank',
    tableName: 'type_accounts_bank',
    timestamps: false
});

module.exports = TypeAccountBank;