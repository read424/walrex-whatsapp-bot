'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('permissions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Nombre único del permiso'
      },
      description: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Descripción del permiso'
      },
      module: {
        type: Sequelize.STRING(30),
        allowNull: false,
        comment: 'Módulo del sistema: users, clients, chat, reports'
      },
      action: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Acción del permiso: create, read, update, delete'
      },
      is_active: {
        type: Sequelize.STRING(1),
        allowNull: false,
        defaultValue: '1',
        comment: 'Estado del registro: 1=Activo, 0=Inactivo'
      }
    });

    // Índices para mejorar el rendimiento de consultas
    await queryInterface.addIndex('permissions', ['name']);
    await queryInterface.addIndex('permissions', ['module']);
    await queryInterface.addIndex('permissions', ['action']);
    await queryInterface.addIndex('permissions', ['is_active']);

    // Índice compuesto para búsquedas por módulo y acción
    await queryInterface.addIndex('permissions', ['module', 'action']);
  },

  async down (queryInterface, Sequelize) {
    // Remover índices
    await queryInterface.removeIndex('permissions', ['module', 'action']);
    await queryInterface.removeIndex('permissions', ['is_active']);
    await queryInterface.removeIndex('permissions', ['action']);
    await queryInterface.removeIndex('permissions', ['module']);
    await queryInterface.removeIndex('permissions', ['name']);
    
    // Remover tabla
    await queryInterface.dropTable('permissions');
  }
};
