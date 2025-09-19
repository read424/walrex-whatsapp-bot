const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');

class InviteReferral extends Model {}


InviteReferral.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_user: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    id_user_referral: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.STRING(1),
        allowNull: false,
        defaultValue: '1'
    }
}, {
    sequelize,
    modelName: 'InviteReferral',
    tableName: 'invite_referral',
    timestamps: true,
    createdAt: 'create_at',
    updatedAt: 'update_at'
});

module.exports = InviteReferral;