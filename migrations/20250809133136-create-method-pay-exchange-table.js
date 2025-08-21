'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('method_pay_exchange', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      id_exchange: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      id_country: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      id_bank: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      alias_name: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      create_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      update_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
    // Índice único compuesto: alias_name + id_country + id_exchange
    await queryInterface.addConstraint('method_pay_exchange', {
      fields: ['alias_name', 'id_country', 'id_exchange'],
      type: 'unique',
      name: 'uniq_method_pay_exchange_alias_country_exchange'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeConstraint('method_pay_exchange', 'uniq_method_pay_exchange_alias_country_exchange');
    await queryInterface.dropTable('method_pay_exchange');
  }
};
