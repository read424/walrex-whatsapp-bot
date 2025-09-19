'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('chatbot_nodes', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            flow_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'ID del flujo al que pertenece este nodo (FK a chatbot_flows)',
                references: {
                    model: 'chatbot_flows',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            parent_node_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'ID del nodo padre (FK a chatbot_nodes) - NULL para nodos raíz',
                references: {
                    model: 'chatbot_nodes',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            node_type: {
                type: Sequelize.ENUM('question', 'response', 'condition'),
                allowNull: false,
                comment: 'Tipo de nodo: question, response, condition'
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Contenido del mensaje/pregunta del nodo'
            },
            order_index: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Orden de aparición del nodo en el flujo'
            },
            is_final: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Indica si es un nodo terminal del flujo'
            },
            has_actions: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Indica si el nodo tiene acciones asociadas'
            },
            wait_for_input: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Indica si el nodo espera respuesta del usuario'
            },
            timeout_seconds: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'Tiempo límite en segundos para respuesta del usuario'
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
        await queryInterface.addIndex('chatbot_nodes', ['flow_id']);
        await queryInterface.addIndex('chatbot_nodes', ['parent_node_id']);
        await queryInterface.addIndex('chatbot_nodes', ['node_type']);
        await queryInterface.addIndex('chatbot_nodes', ['order_index']);
        await queryInterface.addIndex('chatbot_nodes', ['is_final']);
        await queryInterface.addIndex('chatbot_nodes', ['has_actions']);
        await queryInterface.addIndex('chatbot_nodes', ['wait_for_input']);
        await queryInterface.addIndex('chatbot_nodes', ['created_at']);
        
        // Índices compuestos para consultas frecuentes
        await queryInterface.addIndex('chatbot_nodes', {
            fields: ['flow_id', 'order_index'],
            name: 'chatbot_nodes_flow_order_idx'
        });

        await queryInterface.addIndex('chatbot_nodes', {
            fields: ['flow_id', 'parent_node_id'],
            name: 'chatbot_nodes_flow_parent_idx'
        });

        await queryInterface.addIndex('chatbot_nodes', {
            fields: ['flow_id', 'is_final'],
            name: 'chatbot_nodes_flow_final_idx'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('chatbot_nodes');
    }
};
