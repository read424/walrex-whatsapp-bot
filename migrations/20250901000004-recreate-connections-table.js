'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {        
        try {            
            // Recrear la tabla con la estructura correcta
            await queryInterface.createTable('connections', {
                id: {
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                    type: Sequelize.INTEGER
                },
                connection_name: {
                    type: Sequelize.STRING(100),
                    allowNull: false,
                    comment: 'Nombre descriptivo de la conexión (ej: WhatsApp Ventas Principal)'
                },
                provider_type: {
                    type: Sequelize.ENUM('whatsapp', 'facebook', 'instagram', 'telegram', 'whatsapp_api', 'chatweb'),
                    allowNull: false,
                    comment: 'Tipo de proveedor de mensajería'
                },
                department: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    comment: 'ID del departamento asignado (referencia a departments table)'
                },
                welcome_message: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    comment: 'Mensaje de saludo personalizado'
                },
                goodbye_message: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    comment: 'Mensaje de despedida personalizado'
                },
                chatbot_timeout: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: 30,
                    comment: 'Tiempo en minutos para reinicio del chatbot'
                },
                status: {
                    type: Sequelize.ENUM('active', 'inactive', 'error', 'connecting'),
                    allowNull: false,
                    defaultValue: 'inactive',
                    comment: 'Estado actual de la conexión'
                },
                tenant_id: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    comment: 'ID del tenant para multitenancy (referencia a tenants table)'
                },
                settings: {
                    type: Sequelize.JSONB,
                    allowNull: true,
                    comment: 'Configuraciones adicionales específicas del proveedor en formato JSON'
                },
                is_active: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
                    comment: 'Indica si la conexión está activa o no'
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

            // Agregar índices
            await queryInterface.addIndex('connections', ['connection_name']);
            await queryInterface.addIndex('connections', ['provider_type']);
            await queryInterface.addIndex('connections', ['department']);
            await queryInterface.addIndex('connections', ['status']);
            await queryInterface.addIndex('connections', ['tenant_id']);
            await queryInterface.addIndex('connections', ['is_active']);
            await queryInterface.addIndex('connections', ['created_at']);
            
            // Índices compuestos
            await queryInterface.addIndex('connections', {
                fields: ['tenant_id', 'provider_type', 'status'],
                name: 'connections_tenant_provider_status_idx'
            });
            
            await queryInterface.addIndex('connections', {
                fields: ['tenant_id', 'department', 'status'],
                name: 'connections_tenant_department_status_idx'
            });

            await queryInterface.addIndex('connections', {
                fields: ['tenant_id', 'is_active'],
                name: 'connections_tenant_is_active_idx'
            });

            await queryInterface.addIndex('connections', {
                fields: ['provider_type', 'is_active'],
                name: 'connections_provider_is_active_idx'
            });

            // Índice único
            await queryInterface.addIndex('connections', {
                fields: ['connection_name', 'tenant_id'],
                unique: true,
                name: 'connections_name_tenant_unique_idx'
            });
            
        } catch (error) {
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        // Para el rollback, simplemente eliminar la tabla
        await queryInterface.dropTable('connections');
    }
};
