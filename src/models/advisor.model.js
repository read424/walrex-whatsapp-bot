const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');

class Advisor extends Model {}

Advisor.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(60),
        allowNull: false,
        unique: true,
    }
}, { 
    sequelize,
    modelName: 'Advisor',
    tableName: 'advisors',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = Advisor;