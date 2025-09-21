'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Actualizar tabla advisors con nueva estructura
     */
    
    // Agregar nuevas columnas
    await queryInterface.addColumn('advisors', 'role', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'agent'
    });

    await queryInterface.addColumn('advisors', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.addColumn('advisors', 'tenant_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });

    await queryInterface.addColumn('advisors', 'settings', {
      type: Sequelize.JSONB,
      allowNull: true
    });

    // Modificar columnas existentes
    await queryInterface.changeColumn('advisors', 'name', {
      type: Sequelize.STRING(100),
      allowNull: false
    });

    // Corregir nombres de columnas de timestamp (eran createAt y updateAt)
    await queryInterface.renameColumn('advisors', 'createAt', 'createdAt');
    await queryInterface.renameColumn('advisors', 'updateAt', 'updatedAt');
  },

  async down (queryInterface, Sequelize) {
    /**
     * Revertir cambios en tabla advisors
     */
    
    // Eliminar columnas agregadas
    await queryInterface.removeColumn('advisors', 'role');
    await queryInterface.removeColumn('advisors', 'is_active');
    await queryInterface.removeColumn('advisors', 'tenant_id');
    await queryInterface.removeColumn('advisors', 'settings');

    // Restaurar nombres de columnas originales
    await queryInterface.renameColumn('advisors', 'createdAt', 'createAt');
    await queryInterface.renameColumn('advisors', 'updatedAt', 'updateAt');

    // Restaurar tipos de columnas originales
    await queryInterface.changeColumn('advisors', 'name', {
      type: Sequelize.STRING(50),
      allowNull: false
    });
  }
};
