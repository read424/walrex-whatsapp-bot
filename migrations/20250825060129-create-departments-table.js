'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('departments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Nombre del departamento'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Descripción del departamento'
      },
      manager_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID del usuario que es manager del departamento'
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
    await queryInterface.addIndex('departments', ['name']);
    await queryInterface.addIndex('departments', ['manager_id']);
    await queryInterface.addIndex('departments', ['is_active']);

    // Clave foránea para manager_id (referencia a users)
    await queryInterface.addConstraint('departments', {
      fields: ['manager_id'],
      type: 'foreign key',
      name: 'fk_departments_manager',
      references: {
        table: 'users',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remover restricciones
    await queryInterface.removeConstraint('departments', 'fk_departments_manager');
    
    // Remover índices
    await queryInterface.removeIndex('departments', ['is_active']);
    await queryInterface.removeIndex('departments', ['manager_id']);
    await queryInterface.removeIndex('departments', ['name']);
    
    // Remover tabla
    await queryInterface.dropTable('departments');
  }
};
