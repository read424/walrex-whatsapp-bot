'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('employees', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      id_user: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'ID del usuario asociado al empleado'
      },
      employee_code: {
        type: Sequelize.STRING(10),
        allowNull: true,
        unique: true,
        comment: 'Código único del empleado'
      },
      first_name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Nombre del empleado'
      },
      last_name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Apellido del empleado'
      },
      email: {
        type: Sequelize.STRING(80),
        allowNull: false,
        unique: true,
        comment: 'Email único del empleado'
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Número de teléfono del empleado'
      },
      id_department: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID del departamento al que pertenece el empleado'
      },
      hire_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_DATE'),
        comment: 'Fecha de contratación del empleado'
      },
      salary: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Salario del empleado'
      },
      is_active: {
        type: Sequelize.STRING(1),
        allowNull: false,
        defaultValue: '1',
        comment: 'Estado del registro: 1=Activo, 0=Inactivo'
      },
      create_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      update_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Índices para mejorar el rendimiento de consultas
    await queryInterface.addIndex('employees', ['id_user']);
    await queryInterface.addIndex('employees', ['employee_code']);
    await queryInterface.addIndex('employees', ['email']);
    await queryInterface.addIndex('employees', ['id_department']);
    await queryInterface.addIndex('employees', ['is_active']);
    await queryInterface.addIndex('employees', ['hire_date']);

    // Clave foránea para id_user (referencia a users)
    await queryInterface.addConstraint('employees', {
      fields: ['id_user'],
      type: 'foreign key',
      name: 'fk_employees_user',
      references: {
        table: 'users',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Clave foránea para id_department (referencia a departments)
    await queryInterface.addConstraint('employees', {
      fields: ['id_department'],
      type: 'foreign key',
      name: 'fk_employees_department',
      references: {
        table: 'departments',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remover restricciones
    await queryInterface.removeConstraint('employees', 'fk_employees_department');
    await queryInterface.removeConstraint('employees', 'fk_employees_user');
    
    // Remover índices
    await queryInterface.removeIndex('employees', ['hire_date']);
    await queryInterface.removeIndex('employees', ['is_active']);
    await queryInterface.removeIndex('employees', ['id_department']);
    await queryInterface.removeIndex('employees', ['email']);
    await queryInterface.removeIndex('employees', ['employee_code']);
    await queryInterface.removeIndex('employees', ['id_user']);
    
    // Remover tabla
    await queryInterface.dropTable('employees');
  }
};
