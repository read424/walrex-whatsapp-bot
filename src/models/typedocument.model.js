const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');
const Customer = require('./customer.model');

class TypeDocumentId extends Model {
    static associate(models){
        TypeDocumentId.hasMany(models.Customer, {
            foreignKey: 'type_document', // Clave foránea en el modelo Customer
            sourceKey: 'id' // Clave primaria en el modelo TypeDocumentId
        });
    }
}

TypeDocumentId.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    Sigla: {
        type: DataTypes.STRING(7),
        allowNull: false,
        unique: true,
        field: 'sigla'
    },
    Description: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'det_name'
    },
    Status: {
        type: DataTypes.STRING(1),
        allowNull: false,
        defaultValue: '1',
        field: 'status'
    }
}, {
    sequelize,
    modelName: 'TypeDocumentId',
    tableName: 'type_document_id',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = TypeDocumentId;