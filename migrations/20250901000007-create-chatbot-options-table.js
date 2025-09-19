'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('chatbot_options', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            node_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'ID del nodo al que pertenece esta opción (FK a chatbot_nodes)',
                references: {
                    model: 'chatbot_nodes',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            option_text: {
                type: Sequelize.VARCHAR(255),
                allowNull: false,
                comment: 'Texto de la opción que ve el usuario (ej: "Me gustaría ver el catálogo")'
            },
            option_value: {
                type: Sequelize.VARCHAR(100),
                allowNull: false,
                comment: 'Valor interno para lógica del sistema'
            },
            next_node_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'ID del nodo siguiente al que lleva esta opción (FK a chatbot_nodes)',
                references: {
                    model: 'chatbot_nodes',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            order_index: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Orden de aparición de la opción'
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
        await queryInterface.addIndex('chatbot_options', ['node_id']);
        await queryInterface.addIndex('chatbot_options', ['next_node_id']);
        await queryInterface.addIndex('chatbot_options', ['order_index']);
        await queryInterface.addIndex('chatbot_options', ['option_value']);
        await queryInterface.addIndex('chatbot_options', ['created_at']);
        
        // Índices compuestos para consultas frecuentes
        await queryInterface.addIndex('chatbot_options', {
            fields: ['node_id', 'order_index'],
            name: 'chatbot_options_node_order_idx'
        });

        await queryInterface.addIndex('chatbot_options', {
            fields: ['node_id', 'option_value'],
            name: 'chatbot_options_node_value_idx'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('chatbot_options');
    }
};
