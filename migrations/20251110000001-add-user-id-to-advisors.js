'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('advisors', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'ID del usuario asociado al asesor para autenticación'
    });

    // Agregar índice para búsquedas rápidas
    await queryInterface.addIndex('advisors', ['user_id'], {
      name: 'idx_advisors_user_id'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('advisors', 'idx_advisors_user_id');
    await queryInterface.removeColumn('advisors', 'user_id');
  }
};
