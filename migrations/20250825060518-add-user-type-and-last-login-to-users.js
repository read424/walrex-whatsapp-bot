'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Agregar columna id_user_type con valor por defecto 1 (client)
    await queryInterface.addColumn('users', 'id_user_type', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'ID del tipo de usuario (referencia a user_types)'
    });

    // Agregar columna last_login
    await queryInterface.addColumn('users', 'last_login', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp del último login del usuario'
    });

    // Crear índice para mejorar el rendimiento de consultas por tipo de usuario
    await queryInterface.addIndex('users', ['id_user_type'], {
      name: 'idx_users_user_type'
    });

    // Agregar clave foránea para id_user_type
    await queryInterface.addConstraint('users', {
      fields: ['id_user_type'],
      type: 'foreign key',
      name: 'fk_users_user_type',
      references: {
        table: 'user_types',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remover clave foránea
    await queryInterface.removeConstraint('users', 'fk_users_user_type');
    
    // Remover índice
    await queryInterface.removeIndex('users', 'idx_users_user_type');
    
    // Remover columnas agregadas
    await queryInterface.removeColumn('users', 'last_login');
    await queryInterface.removeColumn('users', 'id_user_type');
  }
};
