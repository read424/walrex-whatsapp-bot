'use strict';

/**
 * Migración para agregar el estado 'qr_generated' al enum de status
 * en la tabla whatsapp_connections
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Agregar el nuevo valor 'qr_generated' al enum existente
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_whatsapp_connections_status
      ADD VALUE IF NOT EXISTS 'qr_generated';
    `);

    console.log('✅ Estado "qr_generated" agregado al enum enum_whatsapp_connections_status');
  },

  down: async (queryInterface, Sequelize) => {
    // No es posible remover valores de un enum en PostgreSQL directamente
    // Se necesitaría recrear el tipo completo, lo cual es complejo
    console.log('⚠️  No se puede revertir esta migración automáticamente.');
    console.log('⚠️  Para revertir, necesitas recrear el enum manualmente sin "qr_generated"');
  }
};
