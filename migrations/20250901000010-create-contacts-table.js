'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Crear tabla de contactos para gestionar información de usuarios de WhatsApp
     */
    await queryInterface.createTable('contacts', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      avatar_url: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Crear índices para optimizar consultas
    await queryInterface.addIndex('contacts', ['phone_number'], {
      name: 'idx_contacts_phone'
    });
    await queryInterface.addIndex('contacts', ['tenant_id'], {
      name: 'idx_contacts_tenant'
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Eliminar tabla de contactos
     */
    await queryInterface.dropTable('contacts');
  }
};
