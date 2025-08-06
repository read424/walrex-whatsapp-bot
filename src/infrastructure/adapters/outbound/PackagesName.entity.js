const { Model, DataTypes } = require('sequelize');
const sequelize = require("../../config/DatabaseConfig")

class PackagesName extends Model {}

PackagesName.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name_package: {
        type: DataTypes.STRING(150),
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING(60),
        allowNull: false,
        unique: true,
    },
    message: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
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
    modelName: 'PackagesName',
    tableName: 'packages_registry',
    timestamps: false,
});

module.exports = PackagesName;