'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('user_types', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
        comment: 'Nombre del tipo de usuario: client, agent, supervisor, admin'
      },
      description: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Descripción opcional del tipo de usuario'
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
      }
    });

    // Índices para mejorar el rendimiento de consultas
    await queryInterface.addIndex('user_types', ['name']);
    await queryInterface.addIndex('user_types', ['is_active']);
  },

  async down (queryInterface, Sequelize) {
    // Remover índices
    await queryInterface.removeIndex('user_types', ['is_active']);
    await queryInterface.removeIndex('user_types', ['name']);
    
    // Remover tabla
    await queryInterface.dropTable('user_types');
  }
};
