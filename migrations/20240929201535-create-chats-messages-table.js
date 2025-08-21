'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('chats_messages', {
      id:{
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      phone_number:{
        type: Sequelize.STRING(20),
        allowNull: false
      },
      message:{
        type: Sequelize.TEXT,
        allowNull: false
      },
      received_at:{
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      status:{
        type: Sequelize.ENUM('received', 'read'),
        allowNull: false,
        defaultValue: 'received'
      },
      status_updated_at:{
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      responded_by:{
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references:{
          model: 'advisors',
          key: 'id'
        },
        onUpdate: 'SET NULL',
        onDelete: 'SET NULL'
      },
      responder_type: {
        type: Sequelize.ENUM('advisor', 'system'),
        allowNull: true,
        defaultValue: null
      },
      chat_session_id:{
        type: Sequelize.INTEGER,
        allowNull: false,
        references:{
          model: 'chat_sessions',
          key: 'id'
        },
        onUpdate: 'SET NULL',
        onDelete: 'SET NULL'
      }
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('chats_messages');
  }
};
