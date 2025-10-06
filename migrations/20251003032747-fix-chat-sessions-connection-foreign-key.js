'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 1. Eliminar la foreign key existente que apunta a whatsapp_connections
    await queryInterface.removeConstraint('chat_sessions', 'chat_sessions_connection_id_fkey');
    
    // 2. Crear la nueva foreign key que apunta a connections
    await queryInterface.addConstraint('chat_sessions', {
      fields: ['connection_id'],
      type: 'foreign key',
      name: 'chat_sessions_connection_id_fkey',
      references: {
        table: 'connections',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  },

  async down (queryInterface, Sequelize) {
    // 1. Eliminar la foreign key que apunta a connections
    await queryInterface.removeConstraint('chat_sessions', 'chat_sessions_connection_id_fkey');
    
    // 2. Restaurar la foreign key original que apunta a whatsapp_connections
    await queryInterface.addConstraint('chat_sessions', {
      fields: ['connection_id'],
      type: 'foreign key',
      name: 'chat_sessions_connection_id_fkey',
      references: {
        table: 'whatsapp_connections',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  }
};
