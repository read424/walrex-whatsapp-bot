'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Agregar el campo connection_id
        await queryInterface.addColumn('whatsapp_connections', 'connection_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Referencia a la tabla connections'
        });

        // Agregar la foreign key constraint
        await queryInterface.addConstraint('whatsapp_connections', {
            fields: ['connection_id'],
            type: 'foreign key',
            name: 'whatsapp_connections_connection_id_fkey',
            references: {
                table: 'connections',
                field: 'id'
            },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });

        // Agregar índice para optimizar las consultas con JOIN
        await queryInterface.addIndex('whatsapp_connections', {
            fields: ['connection_id'],
            name: 'whatsapp_connections_connection_id_idx'
        });

        // Índice compuesto para consultas comunes
        await queryInterface.addIndex('whatsapp_connections', {
            fields: ['connection_id', 'status'],
            name: 'whatsapp_connections_connection_status_idx'
        });
    },

    async down(queryInterface, Sequelize) {
        // Remover índices primero
        await queryInterface.removeIndex('whatsapp_connections', 'whatsapp_connections_connection_status_idx');
        await queryInterface.removeIndex('whatsapp_connections', 'whatsapp_connections_connection_id_idx');
        
        // Remover la foreign key constraint
        await queryInterface.removeConstraint('whatsapp_connections', 'whatsapp_connections_connection_id_fkey');
        
        // Remover la columna
        await queryInterface.removeColumn('whatsapp_connections', 'connection_id');
    }
};
