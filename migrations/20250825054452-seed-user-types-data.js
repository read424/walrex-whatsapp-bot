'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Insertar tipos de usuario por defecto
    await queryInterface.bulkInsert('user_types', [
      {
        name: 'client',
        description: 'Cliente del sistema',
        is_active: '1',
        create_at: new Date()
      },
      {
        name: 'agent',
        description: 'Agente de ventas',
        is_active: '1',
        create_at: new Date()
      },
      {
        name: 'supervisor',
        description: 'Supervisor de ventas',
        is_active: '1',
        create_at: new Date()
      },
      {
        name: 'admin',
        description: 'Administrador del sistema',
        is_active: '1',
        create_at: new Date()
      }
    ]);
  },

  async down (queryInterface, Sequelize) {
    // Remover los datos insertados
    await queryInterface.bulkDelete('user_types', {
      name: {
        [Sequelize.Op.in]: ['client', 'agent', 'supervisor', 'admin']
      }
    });
  }
};
