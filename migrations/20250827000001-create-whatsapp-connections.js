'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('whatsapp_connections', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            client_id: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true,
                comment: 'Identificador único del cliente WhatsApp'
            },
            tenant_id: {
                type: Sequelize.STRING(50),
                allowNull: true,
                comment: 'ID del tenant para multitenancy'
            },
            phone_number: {
                type: Sequelize.STRING(20),
                allowNull: true,
                comment: 'Número de teléfono asociado a la sesión'
            },
            session_data: {
                type: Sequelize.JSONB, // Más eficiente en PostgreSQL
                allowNull: true,
                comment: 'Datos de sesión serializados (JSONB)'
            },
            status: {
                type: Sequelize.ENUM('disconnected', 'connecting', 'connected', 'authenticated', 'error'),
                allowNull: false,
                defaultValue: 'disconnected',
                comment: 'Estado actual de la conexión'
            },
            last_seen: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'Última vez que se detectó actividad'
            },
            qr_code: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Código QR actual (base64)'
            },
            device_info: {
                type: Sequelize.JSONB, // Más eficiente en PostgreSQL
                allowNull: true,
                comment: 'Información del dispositivo conectado'
            },
            connection_attempts: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Número de intentos de conexión'
            },
            last_error: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Último error registrado'
            },
            settings: {
                type: Sequelize.JSONB, // Más eficiente en PostgreSQL
                allowNull: true,
                comment: 'Configuraciones específicas de la conexión'
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: 'Si la conexión está activa'
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
        await queryInterface.addIndex('whatsapp_connections', ['client_id']);
        await queryInterface.addIndex('whatsapp_connections', ['tenant_id']);
        await queryInterface.addIndex('whatsapp_connections', ['phone_number']);
        await queryInterface.addIndex('whatsapp_connections', ['status']);
        await queryInterface.addIndex('whatsapp_connections', ['is_active']);
        await queryInterface.addIndex('whatsapp_connections', ['created_at']);
        
        await queryInterface.addIndex('whatsapp_connections', {
            fields: ['device_info'],
            using: 'gin',
            name: 'whatsapp_connections_device_info_gin_idx'
        });
        
        await queryInterface.addIndex('whatsapp_connections', {
            fields: ['settings'],
            using: 'gin', 
            name: 'whatsapp_connections_settings_gin_idx'
        });

        await queryInterface.addIndex('whatsapp_connections', {
            fields: ['tenant_id', 'status', 'is_active'],
            name: 'whatsapp_connections_tenant_status_active_idx'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('whatsapp_connections');
    }
};