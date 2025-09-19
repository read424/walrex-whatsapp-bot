'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('chatbot_node_actions', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            node_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'ID del nodo al que pertenece esta acción (FK a chatbot_nodes)',
                references: {
                    model: 'chatbot_nodes',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            action_type: {
                type: Sequelize.ENUM('send_document', 'transfer_department', 'transfer_agent', 'send_message', 'wait_input', 'end_conversation'),
                allowNull: false,
                comment: 'Tipo de acción a ejecutar'
            },
            action_config: {
                type: Sequelize.JSONB,
                allowNull: true,
                comment: 'Configuración específica de la acción en formato JSON'
            },
            execution_order: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Orden de ejecución si hay múltiples acciones en el mismo nodo'
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: 'Indica si la acción está activa'
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
        await queryInterface.addIndex('chatbot_node_actions', ['node_id']);
        await queryInterface.addIndex('chatbot_node_actions', ['action_type']);
        await queryInterface.addIndex('chatbot_node_actions', ['execution_order']);
        await queryInterface.addIndex('chatbot_node_actions', ['is_active']);
        await queryInterface.addIndex('chatbot_node_actions', ['created_at']);
        
        // Índices compuestos para consultas frecuentes
        await queryInterface.addIndex('chatbot_node_actions', {
            fields: ['node_id', 'execution_order'],
            name: 'chatbot_node_actions_node_order_idx'
        });

        await queryInterface.addIndex('chatbot_node_actions', {
            fields: ['node_id', 'is_active'],
            name: 'chatbot_node_actions_node_active_idx'
        });

        await queryInterface.addIndex('chatbot_node_actions', {
            fields: ['action_type', 'is_active'],
            name: 'chatbot_node_actions_type_active_idx'
        });

        // Índice GIN para búsquedas en action_config
        await queryInterface.sequelize.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS chatbot_node_actions_config_gin_idx 
            ON chatbot_node_actions USING GIN (action_config)
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('chatbot_node_actions');
    }
};
