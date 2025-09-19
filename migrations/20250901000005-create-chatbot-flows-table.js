'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('chatbot_flows', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            id_connection: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'ID de la conexión asociada (FK a connections)',
                references: {
                    model: 'connections',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            id_department: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'ID del departamento asociado (FK a departments)',
                references: {
                    model: 'departments',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: 'Indica si el flujo está activo'
            },
            trigger_keywords: {
                type: Sequelize.JSONB,
                allowNull: true,
                comment: 'Palabras clave que activan este flujo en formato JSON array'
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Índices para optimización
        await queryInterface.addIndex('chatbot_flows', ['id_connection']);
        await queryInterface.addIndex('chatbot_flows', ['id_department']);
        await queryInterface.addIndex('chatbot_flows', ['is_active']);
        await queryInterface.addIndex('chatbot_flows', ['created_at']);
        
        // Índice compuesto para consultas frecuentes
        await queryInterface.addIndex('chatbot_flows', {
            fields: ['id_connection', 'is_active'],
            name: 'chatbot_flows_connection_active_idx'
        });

        // Índice GIN para búsquedas en trigger_keywords
        await queryInterface.sequelize.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS chatbot_flows_trigger_keywords_gin_idx 
            ON chatbot_flows USING GIN (trigger_keywords)
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('chatbot_flows');
    }
};
