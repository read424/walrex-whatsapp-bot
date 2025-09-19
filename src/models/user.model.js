const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');
const Customer = require('./customer.model');
const UserType = require('./UserType.model');

class User extends Model {
    static associate(models){
        User.belongsTo(models.Customer, {
            foreignKey: 'id_client',
            as: 'customer'
        });

        User.belongsTo(models.UserType, {
            foreignKey: 'id_user_type',
            as: 'user_type'
        })
    };
}

User.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    id_client: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
            model: 'clients',
            key: 'id'
        }
    },
    username: {
        type: DataTypes.STRING(75),
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING(60),
        allowNull: false,
        field: 'contrasenia'
    },
    code_referral: {
        type: DataTypes.STRING(8),
        allowNull: true
    },
    auth_two_factor: {
        type: DataTypes.STRING(1),
        allowNull: false,
        defaultValue: '0'
    },
    id_user_type: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false
    },
    last_login: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(1),
        allowNull: false,
        defaultValue: '1'
    },
}, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    createdAt: 'create_at',
    updatedAt: 'update_at'
});


module.exports = User;