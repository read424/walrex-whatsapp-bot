'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Agregar valor 'connecting' al ENUM del campo status en la tabla connections
     */
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Verificar si el valor 'connecting' ya existe en el ENUM
      const [results] = await queryInterface.sequelize.query(
        `SELECT unnest(enum_range(NULL::enum_connections_status)) as enum_value`,
        { transaction }
      );
      
      const enumValues = results.map(row => row.enum_value);
      
      if (!enumValues.includes('connecting')) {
        // Agregar el valor 'connecting' al ENUM existente
        await queryInterface.sequelize.query(
          `ALTER TYPE enum_connections_status ADD VALUE 'connecting'`,
          { transaction }
        );
        
        console.log('Valor "connecting" agregado al ENUM del campo status en connections');
      } else {
        console.log('El valor "connecting" ya existe en el ENUM del campo status');
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error al agregar valor connecting al ENUM:', error.message);
      throw error;
    }
  },

  async down (queryInterface, Sequelize) {
    /**
     * Revertir: Remover valor 'connecting' del ENUM del campo status
     * NOTA: PostgreSQL no permite eliminar valores de ENUM directamente
     * Se requiere recrear el ENUM sin el valor 'connecting'
     */
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Verificar si hay registros usando el valor 'connecting'
      const [results] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM connections WHERE status = 'connecting'`,
        { transaction }
      );
      
      if (results[0].count > 0) {
        // Actualizar registros que usan 'connecting' a 'inactive'
        await queryInterface.sequelize.query(
          `UPDATE connections SET status = 'inactive' WHERE status = 'connecting'`,
          { transaction }
        );
        console.log(`Actualizados ${results[0].count} registros de 'connecting' a 'inactive'`);
      }
      
      // Crear nuevo ENUM sin 'connecting'
      await queryInterface.sequelize.query(
        `CREATE TYPE enum_connections_status_new AS ENUM ('active', 'inactive', 'error')`,
        { transaction }
      );
      
      // Cambiar el tipo de columna al nuevo ENUM
      await queryInterface.sequelize.query(
        `ALTER TABLE connections ALTER COLUMN status TYPE enum_connections_status_new USING status::text::enum_connections_status_new`,
        { transaction }
      );
      
      // Eliminar el ENUM antiguo y renombrar el nuevo
      await queryInterface.sequelize.query(
        `DROP TYPE enum_connections_status`,
        { transaction }
      );
      
      await queryInterface.sequelize.query(
        `ALTER TYPE enum_connections_status_new RENAME TO enum_connections_status`,
        { transaction }
      );
      
      console.log('Valor "connecting" removido del ENUM del campo status');
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error al revertir ENUM:', error.message);
      throw error;
    }
  }
};
