'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Insertar datos de ejemplo para trading_currencies
    await queryInterface.bulkInsert('trading_currencies', [
      {
        id_company: 1,
        id_currency_base: 1, // USD
        id_currency_quote: 2, // PEN
        porc_revenue: 2.500,
        status: '1',
        create_at: new Date(),
        update_at: new Date()
      },
      {
        id_company: 1,
        id_currency_base: 2, // PEN
        id_currency_quote: 1, // USD
        porc_revenue: 2.500,
        status: '1',
        create_at: new Date(),
        update_at: new Date()
      },
      {
        id_company: 1,
        id_currency_base: 3, // EUR
        id_currency_quote: 2, // PEN
        porc_revenue: 2.750,
        status: '1',
        create_at: new Date(),
        update_at: new Date()
      },
      {
        id_company: 1,
        id_currency_base: 2, // PEN
        id_currency_quote: 3, // EUR
        porc_revenue: 2.750,
        status: '1',
        create_at: new Date(),
        update_at: new Date()
      },
      {
        id_company: 1,
        id_currency_base: 1, // USD
        id_currency_quote: 3, // EUR
        porc_revenue: 1.500,
        status: '1',
        create_at: new Date(),
        update_at: new Date()
      },
      {
        id_company: 1,
        id_currency_base: 3, // EUR
        id_currency_quote: 1, // USD
        porc_revenue: 1.500,
        status: '1',
        create_at: new Date(),
        update_at: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    // Revertir la inserción
    await queryInterface.bulkDelete('trading_currencies', null, {});
  }
};
