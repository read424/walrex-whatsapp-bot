'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Renombrar el campo mount_price a amount_price en la tabla price_exchanges
     */
    await queryInterface.renameColumn('price_exchange', 'mount_price', 'amount_price');
  },

  async down (queryInterface, Sequelize) {
    /**
     * Revertir el cambio: renombrar amount_price de vuelta a mount_price
     */
    await queryInterface.renameColumn('price_exchange', 'amount_price', 'mount_price');
  }
};
