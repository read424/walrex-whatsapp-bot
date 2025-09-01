const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');

class Employee extends Model {
    static associate(models){
        //User.belongsTo(models.Customer, {
        //    foreignKey: 'id_client',
        //    as: 'customer'
        //});
    };
}

Employee.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_user: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID del usuario asociado al empleado'
    },
    employee_code: {
        type: DataTypes.STRING(10),
        allowNull: true,
        unique: true,
        comment: 'Código único del empleado'
    },
    first_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Nombre del empleado'
    },
    last_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Apellido del empleado'
    },
    email: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
        comment: 'Email único del empleado'
    },
    phone_number: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Número de teléfono del empleado'
    },
    id_department: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del departamento al que pertenece el empleado'
    },
    hire_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Fecha de contratación del empleado'
    },
    salary: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Salario del empleado'
    },
    is_active: {
        type: DataTypes.STRING(1),
        allowNull: false,
        defaultValue: '1',
        comment: 'Estado del registro: 1=Activo, 0=Inactivo'
    }
},{
    sequelize,
    modelName: 'Employee',
    tableName: 'employees',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});