'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('trading_currencies', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      id_company: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'ID de la empresa que configura el trading'
      },
      id_currency_base: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'ID de la moneda base para el trading'
      },
      id_currency_quote: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'ID de la moneda cotizada para el trading'
      },
      porc_revenue: {
        type: Sequelize.DECIMAL(6, 3),
        allowNull: false,
        comment: 'Porcentaje de ganancia/revenue para el trading'
      },
      status: {
        type: Sequelize.STRING(1),
        allowNull: false,
        defaultValue: '1',
        comment: 'Estado del registro: 1=Activo, 0=Inactivo'
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

    // Índices para mejorar el rendimiento de consultas
    await queryInterface.addIndex('trading_currencies', ['id_company']);
    await queryInterface.addIndex('trading_currencies', ['id_currency_base']);
    await queryInterface.addIndex('trading_currencies', ['id_currency_quote']);
    await queryInterface.addIndex('trading_currencies', ['status']);

    // Índice único compuesto: company + currency_base + currency_quote
    await queryInterface.addConstraint('trading_currencies', {
      fields: ['id_company', 'id_currency_base', 'id_currency_quote'],
      type: 'unique',
      name: 'uniq_trading_currencies_company_base_quote'
    });

    // Claves foráneas
    await queryInterface.addConstraint('trading_currencies', {
      fields: ['id_currency_base'],
      type: 'foreign key',
      name: 'fk_trading_currencies_currency_base',
      references: {
        table: 'currencies',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    await queryInterface.addConstraint('trading_currencies', {
      fields: ['id_currency_quote'],
      type: 'foreign key',
      name: 'fk_trading_currencies_currency_quote',
      references: {
        table: 'currencies',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remover restricciones
    await queryInterface.removeConstraint('trading_currencies', 'fk_trading_currencies_currency_quote');
    await queryInterface.removeConstraint('trading_currencies', 'fk_trading_currencies_currency_base');
    await queryInterface.removeConstraint('trading_currencies', 'uniq_trading_currencies_company_base_quote');
    
    // Remover índices
    await queryInterface.removeIndex('trading_currencies', ['status']);
    await queryInterface.removeIndex('trading_currencies', ['id_currency_quote']);
    await queryInterface.removeIndex('trading_currencies', ['id_currency_base']);
    await queryInterface.removeIndex('trading_currencies', ['id_company']);
    
    // Remover tabla
    await queryInterface.dropTable('trading_currencies');
  }
};
