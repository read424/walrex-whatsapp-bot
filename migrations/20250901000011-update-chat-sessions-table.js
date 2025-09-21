'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Actualizar tabla chat_sessions con nueva estructura - Versión simple
     */
    
    // Verificar qué columnas existen y agregar solo las que faltan
    const tableDescription = await queryInterface.describeTable('chat_sessions');
    
    // Agregar contact_id si no existe
    if (!tableDescription.contact_id) {
      await queryInterface.addColumn('chat_sessions', 'contact_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'contacts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    // Agregar connection_id si no existe
    if (!tableDescription.connection_id) {
      await queryInterface.addColumn('chat_sessions', 'connection_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'whatsapp_connections',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    // Agregar status si no existe
    if (!tableDescription.status) {
      await queryInterface.addColumn('chat_sessions', 'status', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active'
      });
    }

    // Agregar tenant_id si no existe
    if (!tableDescription.tenant_id) {
      await queryInterface.addColumn('chat_sessions', 'tenant_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }

    // Agregar metadata si no existe
    if (!tableDescription.metadata) {
      await queryInterface.addColumn('chat_sessions', 'metadata', {
        type: Sequelize.JSONB,
        allowNull: true
      });
    }

    // Agregar createdAt si no existe
    if (!tableDescription.createdAt) {
      await queryInterface.addColumn('chat_sessions', 'createdAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW
      });
    }

    // Agregar updatedAt si no existe
    if (!tableDescription.updatedAt) {
      await queryInterface.addColumn('chat_sessions', 'updatedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW
      });
    }

    // Renombrar handle_by a handled_by solo si handle_by existe y handled_by no existe
    if (tableDescription.handle_by && !tableDescription.handled_by) {
      await queryInterface.renameColumn('chat_sessions', 'handle_by', 'handled_by');
    }

    // Actualizar registros existentes con timestamps
    try {
      await queryInterface.sequelize.query(`
        UPDATE chat_sessions 
        SET "createdAt" = COALESCE(started_at, NOW()),
            "updatedAt" = COALESCE(started_at, NOW())
        WHERE "createdAt" IS NULL OR "updatedAt" IS NULL
      `);

      // Hacer las columnas NOT NULL
      await queryInterface.changeColumn('chat_sessions', 'createdAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      });

      await queryInterface.changeColumn('chat_sessions', 'updatedAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      });
    } catch (error) {
      console.log('No se pudieron actualizar los timestamps:', error.message);
    }

    // Agregar índices si no existen
    try {
      await queryInterface.addIndex('chat_sessions', ['contact_id'], {
        name: 'idx_chat_sessions_contact_id'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.log('No se pudo crear índice contact_id:', error.message);
      }
    }

    try {
      await queryInterface.addIndex('chat_sessions', ['connection_id'], {
        name: 'idx_chat_sessions_connection_id'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.log('No se pudo crear índice connection_id:', error.message);
      }
    }

    try {
      await queryInterface.addIndex('chat_sessions', ['status'], {
        name: 'idx_chat_sessions_status'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.log('No se pudo crear índice status:', error.message);
      }
    }
  },

  async down (queryInterface, Sequelize) {
    /**
     * Revertir cambios en tabla chat_sessions
     */
    
    // Eliminar índices
    try {
      await queryInterface.removeIndex('chat_sessions', ['contact_id']);
    } catch (error) {
      console.log('No se pudo eliminar índice contact_id:', error.message);
    }

    try {
      await queryInterface.removeIndex('chat_sessions', ['connection_id']);
    } catch (error) {
      console.log('No se pudo eliminar índice connection_id:', error.message);
    }

    try {
      await queryInterface.removeIndex('chat_sessions', ['status']);
    } catch (error) {
      console.log('No se pudo eliminar índice status:', error.message);
    }

    // Eliminar columnas agregadas
    try {
      await queryInterface.removeColumn('chat_sessions', 'contact_id');
    } catch (error) {
      console.log('No se pudo eliminar columna contact_id:', error.message);
    }

    try {
      await queryInterface.removeColumn('chat_sessions', 'connection_id');
    } catch (error) {
      console.log('No se pudo eliminar columna connection_id:', error.message);
    }

    try {
      await queryInterface.removeColumn('chat_sessions', 'status');
    } catch (error) {
      console.log('No se pudo eliminar columna status:', error.message);
    }

    try {
      await queryInterface.removeColumn('chat_sessions', 'tenant_id');
    } catch (error) {
      console.log('No se pudo eliminar columna tenant_id:', error.message);
    }

    try {
      await queryInterface.removeColumn('chat_sessions', 'metadata');
    } catch (error) {
      console.log('No se pudo eliminar columna metadata:', error.message);
    }

    try {
      await queryInterface.removeColumn('chat_sessions', 'createdAt');
    } catch (error) {
      console.log('No se pudo eliminar columna createdAt:', error.message);
    }

    try {
      await queryInterface.removeColumn('chat_sessions', 'updatedAt');
    } catch (error) {
      console.log('No se pudo eliminar columna updatedAt:', error.message);
    }

    // Restaurar nombre de columna si es necesario
    try {
      await queryInterface.renameColumn('chat_sessions', 'handled_by', 'handle_by');
    } catch (error) {
      console.log('No se pudo restaurar nombre de columna:', error.message);
    }
  }
};
