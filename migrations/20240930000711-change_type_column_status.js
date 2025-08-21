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
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // await queryInterface.sequelize.query(
      //   `ALTER TYPE enum_chats_messages_status ADD VALUE '-1';`
      // , { transaction });

      await queryInterface.sequelize.query(
        `UPDATE chats_messages SET status = '-1' WHERE status NOT IN ('received', 'read');`
      , { transaction });

      await queryInterface.changeColumn('chats_messages', 'status', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      }, { transaction });

      await transaction.commit();
    }catch(error){
      // Si ocurre un error, hacemos rollback de todos los cambios
      await transaction.rollback();
      // Lanza el error para que se pueda detectar
      throw error;
    }
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.changeColumn('chats_messages', 'status', {
      type: Sequelize.ENUM('received', 'read'),
      allowNull: false,
      defaultValue: 'received'
    });
  }
};
