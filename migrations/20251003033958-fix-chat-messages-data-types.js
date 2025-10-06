'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Usar SQL directo para cambiar los tipos de datos
    await queryInterface.sequelize.query(`
      ALTER TABLE chat_messages 
      ALTER COLUMN status TYPE VARCHAR(20) USING 
        CASE 
          WHEN status = -1 THEN 'sent'
          WHEN status = 0 THEN 'sent'
          WHEN status = 1 THEN 'sent'
          WHEN status = 2 THEN 'delivered'
          WHEN status = 3 THEN 'read'
          WHEN status = 4 THEN 'failed'
          ELSE 'sent'
        END
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE chat_messages 
      ALTER COLUMN responder_type TYPE VARCHAR(20) USING 
        CASE 
          WHEN responder_type IS NULL THEN 'human'
          WHEN responder_type = 1 THEN 'human'
          WHEN responder_type = 2 THEN 'bot'
          ELSE 'human'
        END
    `);

    // Establecer valores por defecto
    await queryInterface.sequelize.query(`
      ALTER TABLE chat_messages 
      ALTER COLUMN status SET DEFAULT 'sent'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE chat_messages 
      ALTER COLUMN responder_type SET DEFAULT 'human'
    `);

    // Limpiar columnas temporales si existen
    try {
      await queryInterface.removeColumn('chat_messages', 'status_temp');
    } catch (e) {
      // Columna no existe, continuar
    }
    
    try {
      await queryInterface.removeColumn('chat_messages', 'message_type_temp');
    } catch (e) {
      // Columna no existe, continuar
    }
    
    try {
      await queryInterface.removeColumn('chat_messages', 'direction_temp');
    } catch (e) {
      // Columna no existe, continuar
    }
    
    try {
      await queryInterface.removeColumn('chat_messages', 'responder_type_temp');
    } catch (e) {
      // Columna no existe, continuar
    }
  },

  async down (queryInterface, Sequelize) {
    // Revertir los cambios (volver a smallint)
    await queryInterface.changeColumn('chat_messages', 'status', {
      type: Sequelize.SMALLINT,
      allowNull: false,
      defaultValue: 1
    });

    await queryInterface.changeColumn('chat_messages', 'message_type', {
      type: Sequelize.SMALLINT,
      allowNull: false,
      defaultValue: 1
    });

    await queryInterface.changeColumn('chat_messages', 'direction', {
      type: Sequelize.SMALLINT,
      allowNull: false
    });

    await queryInterface.changeColumn('chat_messages', 'responder_type', {
      type: Sequelize.SMALLINT,
      allowNull: true,
      defaultValue: 1
    });
  }
};
