const { Model, DataTypes } = require('sequelize');
const sequelize = require('../../../../config/DatabaseConfig');
const User = require('./user.model');
// const TypeDocumentId = require('./typedocument.model');

class Customer extends Model {
    // static associate(models){
    //     // Relación: un Customer pertenece a un TypeDocumentId
    //     Customer.belongsTo(models.TypeDocumentId, {
    //         foreignKey: 'type_document', // Clave foránea en el modelo Customer
    //         targetKey: 'id' // Clave primaria en el modelo TypeDocumentId
    //     });
    // }

    static associate(models){
        // Definir la asociación
        Customer.hasOne(models.User, {
            foreignKey: 'id_client', // La clave foránea en User
            as: 'user'  // Alias
        });
    };
}

Customer.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    type_document: {
        type: DataTypes.INTEGER,
        field: 'id_type_document'
    },
    num_document: {
        type: DataTypes.STRING(12),
        allowNull: true,
        field: 'num_dni'
    },
    primer_apellido:{
        type: DataTypes.STRING(45),
        allowNull: false,
    },
    segundo_apellido:{
        type: DataTypes.STRING(45),
        allowNull: false,
    },
    Names:{
        type: DataTypes.STRING(45),
        allowNull: false,
        field: 'nombres'
    },
    Gender:{
        type: DataTypes.STRING(1),
        allowNull: false,
        field: 'sexo',
        defaultValue: '1'
    },
    Email:{
        type: DataTypes.STRING(60),
        allowNull: false,
        unique: true,
        field: 'det_email',
    },
    DateBirth:{
        type: DataTypes.DATE,
        field: 'date_birth'
    },
    Profession:{
        type: DataTypes.INTEGER,
        field: 'id_profesion'
    },
    IsPEP:{
        type: DataTypes.STRING(1),
        field: 'is_pep',
        defaultValue: 0
    },
    Country:{
        type: DataTypes.INTEGER,
        field: 'id_country_resident'
    },
    Phone:{
        type: DataTypes.STRING(15),
        field: 'phone_number'
    },
    id_country_phone:{
        type: DataTypes.STRING(5),
        allowNull: false
    },
    tenantId: {
        type: DataTypes.INTEGER,
        field: 'tenant_id',
        defaultValue: 1
    },
    DateDisabled:{
        type: DataTypes.DATE,
        field: 'date_disabled'
    }
}, {
    sequelize,
    modelName: 'Customer',
    tableName: 'clients',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Customer;