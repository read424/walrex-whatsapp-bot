'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Agregar columna name_pay_binance a la tabla banks
     */
    await queryInterface.addColumn('banks', 'name_pay_binance', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Revertir: eliminar columna name_pay_binance de la tabla banks
     */
    await queryInterface.removeColumn('banks', 'name_pay_binance');
  }
};
