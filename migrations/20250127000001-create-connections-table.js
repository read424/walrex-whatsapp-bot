'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('connections', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            connection_name: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'Nombre descriptivo de la conexión'
            },
            provider_type: {
                type: Sequelize.ENUM('whatsapp', 'facebook', 'instagram', 'telegram', 'whatsapp_api', 'chatweb'),
                allowNull: false,
                comment: 'Tipo de proveedor de mensajería'
            },
            department: {
                type: Sequelize.STRING(100),
                allowNull: true,
                comment: 'Departamento asociado a la conexión'
            },
            welcome_message: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Mensaje de bienvenida para nuevos usuarios'
            },
            goodbye_message: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Mensaje de despedida para usuarios'
            },
            chatbot_timeout: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'Tiempo de timeout en segundos para el chatbot'
            },
            status: {
                type: Sequelize.ENUM('active', 'inactive', 'error'),
                allowNull: false,
                defaultValue: 'inactive',
                comment: 'Estado actual de la conexión'
            },
            tenant_id: {
                type: Sequelize.STRING(50),
                allowNull: true,
                comment: 'ID del tenant para multitenancy'
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
        await queryInterface.addIndex('connections', ['connection_name']);
        await queryInterface.addIndex('connections', ['provider_type']);
        await queryInterface.addIndex('connections', ['department']);
        await queryInterface.addIndex('connections', ['status']);
        await queryInterface.addIndex('connections', ['tenant_id']);
        await queryInterface.addIndex('connections', ['created_at']);
        
        // Índice compuesto para consultas comunes
        await queryInterface.addIndex('connections', {
            fields: ['tenant_id', 'provider_type', 'status'],
            name: 'connections_tenant_provider_status_idx'
        });
        
        await queryInterface.addIndex('connections', {
            fields: ['tenant_id', 'department', 'status'],
            name: 'connections_tenant_department_status_idx'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('connections');
    }
};
