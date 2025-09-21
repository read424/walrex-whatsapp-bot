'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Actualizar tabla chats_messages con nueva estructura - Versión simple
     */
    
    // Renombrar tabla de chats_messages a chat_messages si no existe chat_messages
    try {
      const tables = await queryInterface.showAllTables();
      if (tables.includes('chats_messages') && !tables.includes('chat_messages')) {
        await queryInterface.renameTable('chats_messages', 'chat_messages');
      }
    } catch (error) {
      console.log('No se pudo renombrar tabla:', error.message);
    }

    // Verificar qué columnas existen y agregar solo las que faltan
    let tableDescription;
    try {
      tableDescription = await queryInterface.describeTable('chat_messages');
    } catch (error) {
      console.log('No se pudo describir tabla chat_messages:', error.message);
      return;
    }

    // Agregar contact_id si no existe
    if (!tableDescription.contact_id) {
      await queryInterface.addColumn('chat_messages', 'contact_id', {
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

    // Agregar message_type si no existe
    if (!tableDescription.message_type) {
      await queryInterface.addColumn('chat_messages', 'message_type', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'text'
      });
    }

    // Agregar content si no existe
    if (!tableDescription.content) {
      await queryInterface.addColumn('chat_messages', 'content', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    // Agregar media_url si no existe
    if (!tableDescription.media_url) {
      await queryInterface.addColumn('chat_messages', 'media_url', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    // Agregar media_metadata si no existe
    if (!tableDescription.media_metadata) {
      await queryInterface.addColumn('chat_messages', 'media_metadata', {
        type: Sequelize.JSONB,
        allowNull: true
      });
    }

    // Agregar direction si no existe
    if (!tableDescription.direction) {
      await queryInterface.addColumn('chat_messages', 'direction', {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'incoming'
      });
    }

    // Agregar whatsapp_message_id si no existe
    if (!tableDescription.whatsapp_message_id) {
      await queryInterface.addColumn('chat_messages', 'whatsapp_message_id', {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true
      });
    }

    // Agregar tenant_id si no existe
    if (!tableDescription.tenant_id) {
      await queryInterface.addColumn('chat_messages', 'tenant_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }

    // Agregar createdAt si no existe
    if (!tableDescription.createdAt) {
      await queryInterface.addColumn('chat_messages', 'createdAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW
      });
    }

    // Agregar updatedAt si no existe
    if (!tableDescription.updatedAt) {
      await queryInterface.addColumn('chat_messages', 'updatedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW
      });
    }

    // Migrar datos de message a content si existe message
    if (tableDescription.message && !tableDescription.content) {
      try {
        await queryInterface.sequelize.query(`
          UPDATE chat_messages 
          SET content = message 
          WHERE message IS NOT NULL AND content IS NULL
        `);
      } catch (error) {
        console.log('No se pudieron migrar datos de message a content:', error.message);
      }
    }

    // Actualizar registros existentes con timestamps
    try {
      await queryInterface.sequelize.query(`
        UPDATE chat_messages 
        SET "createdAt" = COALESCE(received_at, NOW()),
            "updatedAt" = COALESCE(received_at, NOW())
        WHERE "createdAt" IS NULL OR "updatedAt" IS NULL
      `);

      // Hacer las columnas NOT NULL
      await queryInterface.changeColumn('chat_messages', 'createdAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      });

      await queryInterface.changeColumn('chat_messages', 'updatedAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      });
    } catch (error) {
      console.log('No se pudieron actualizar los timestamps:', error.message);
    }

    // Agregar índices si no existen
    try {
      await queryInterface.addIndex('chat_messages', ['chat_session_id'], {
        name: 'idx_chat_messages_session_id'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.log('No se pudo crear índice session_id:', error.message);
      }
    }

    try {
      await queryInterface.addIndex('chat_messages', ['whatsapp_message_id'], {
        name: 'idx_chat_messages_whatsapp_id'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.log('No se pudo crear índice whatsapp_id:', error.message);
      }
    }

    try {
      await queryInterface.addIndex('chat_messages', ['createdAt'], {
        name: 'idx_chat_messages_created_at'
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.log('No se pudo crear índice created_at:', error.message);
      }
    }
  },

  async down (queryInterface, Sequelize) {
    /**
     * Revertir cambios en tabla chat_messages
     */
    
    // Eliminar índices
    try {
      await queryInterface.removeIndex('chat_messages', ['chat_session_id']);
    } catch (error) {
      console.log('No se pudo eliminar índice session_id:', error.message);
    }

    try {
      await queryInterface.removeIndex('chat_messages', ['whatsapp_message_id']);
    } catch (error) {
      console.log('No se pudo eliminar índice whatsapp_id:', error.message);
    }

    try {
      await queryInterface.removeIndex('chat_messages', ['createdAt']);
    } catch (error) {
      console.log('No se pudo eliminar índice created_at:', error.message);
    }

    // Eliminar columnas agregadas
    const columnsToRemove = [
      'contact_id', 'message_type', 'content', 'media_url', 
      'media_metadata', 'direction', 'whatsapp_message_id', 
      'tenant_id', 'createdAt', 'updatedAt'
    ];

    for (const column of columnsToRemove) {
      try {
        await queryInterface.removeColumn('chat_messages', column);
      } catch (error) {
        console.log(`No se pudo eliminar columna ${column}:`, error.message);
      }
    }

    // Restaurar nombre de tabla
    try {
      await queryInterface.renameTable('chat_messages', 'chats_messages');
    } catch (error) {
      console.log('No se pudo restaurar nombre de tabla:', error.message);
    }
  }
};
