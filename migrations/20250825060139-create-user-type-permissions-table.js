'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('user_type_permissions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      id_user_type: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'ID del tipo de usuario'
      },
      id_permission: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'ID del permiso'
      }
    });

    // Índices para mejorar el rendimiento de consultas
    await queryInterface.addIndex('user_type_permissions', ['id_user_type']);
    await queryInterface.addIndex('user_type_permissions', ['id_permission']);

    // Restricción única compuesta
    await queryInterface.addConstraint('user_type_permissions', {
      fields: ['id_user_type', 'id_permission'],
      type: 'unique',
      name: 'uniq_user_type_permission'
    });

    // Clave foránea para id_user_type (referencia a user_types)
    await queryInterface.addConstraint('user_type_permissions', {
      fields: ['id_user_type'],
      type: 'foreign key',
      name: 'fk_user_type_permissions_user_type',
      references: {
        table: 'user_types',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Clave foránea para id_permission (referencia a permissions)
    await queryInterface.addConstraint('user_type_permissions', {
      fields: ['id_permission'],
      type: 'foreign key',
      name: 'fk_user_type_permissions_permission',
      references: {
        table: 'permissions',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

  },

  async down (queryInterface, Sequelize) {
    // Remover restricciones
    await queryInterface.removeConstraint('user_type_permissions', 'fk_user_type_permissions_permission');
    await queryInterface.removeConstraint('user_type_permissions', 'fk_user_type_permissions_user_type');
    await queryInterface.removeConstraint('user_type_permissions', 'uniq_user_type_permission');
    
    // Remover índices
    await queryInterface.removeIndex('user_type_permissions', ['id_permission']);
    await queryInterface.removeIndex('user_type_permissions', ['id_user_type']);
    
    // Remover tabla
    await queryInterface.dropTable('user_type_permissions');
  }
};
