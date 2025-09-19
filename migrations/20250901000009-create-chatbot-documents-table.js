'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('chatbot_documents', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            connection_id: {
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
            document_name: {
                type: Sequelize.VARCHAR(255),
                allowNull: false,
                comment: 'Nombre descriptivo del documento (ej: "Catálogo Productos")'
            },
            document_type: {
                type: Sequelize.VARCHAR(50),
                allowNull: false,
                comment: 'Tipo de documento: catalog, price_list, brochure, manual, etc.'
            },
            file_path: {
                type: Sequelize.VARCHAR(500),
                allowNull: true,
                comment: 'Ruta local del archivo en el servidor'
            },
            file_url: {
                type: Sequelize.VARCHAR(500),
                allowNull: true,
                comment: 'URL del archivo si está almacenado en cloud'
            },
            mime_type: {
                type: Sequelize.VARCHAR(100),
                allowNull: true,
                comment: 'Tipo MIME del archivo (ej: application/pdf, image/jpeg)'
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: 'Indica si el documento está activo y disponible'
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
        await queryInterface.addIndex('chatbot_documents', ['connection_id']);
        await queryInterface.addIndex('chatbot_documents', ['document_type']);
        await queryInterface.addIndex('chatbot_documents', ['is_active']);
        await queryInterface.addIndex('chatbot_documents', ['created_at']);
        
        // Índices compuestos para consultas frecuentes
        await queryInterface.addIndex('chatbot_documents', {
            fields: ['connection_id', 'is_active'],
            name: 'chatbot_documents_connection_active_idx'
        });

        await queryInterface.addIndex('chatbot_documents', {
            fields: ['connection_id', 'document_type'],
            name: 'chatbot_documents_connection_type_idx'
        });

        await queryInterface.addIndex('chatbot_documents', {
            fields: ['document_type', 'is_active'],
            name: 'chatbot_documents_type_active_idx'
        });

        // Índice único para evitar documentos duplicados por conexión
        await queryInterface.addIndex('chatbot_documents', {
            fields: ['connection_id', 'document_name'],
            unique: true,
            name: 'chatbot_documents_connection_name_unique_idx'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('chatbot_documents');
    }
};
