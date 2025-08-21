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
      await queryInterface.sequelize.query(
        `ALTER TABLE chats_messages ALTER COLUMN responder_type TYPE SMALLINT USING responder_type::SMALLINT;`
      , { transaction });
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
  }
};
