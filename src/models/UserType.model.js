const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');

class UserType extends Model {}

UserType.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        comment: 'Nombre del tipo de usuario: client, agent, supervisor, admin'
    },
    description: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Descripción del tipo de usuario'
    },
    is_active: {
        type: DataTypes.STRING(1),
        allowNull: false,
        defaultValue: '1',
        comment: 'Estado del registro: 1=Activo, 0=Inactivo'
    }
}, {
    sequelize,
    modelName: 'UserType',
    tableName: 'user_types',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = UserType;