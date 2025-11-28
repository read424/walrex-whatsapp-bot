'use strict';

/**
 * Migración: Crear tabla unificada channel_connections
 *
 * Esta tabla reemplaza y unifica:
 * - connections
 * - whatsapp_connections
 *
 * Soporta múltiples canales: WhatsApp Web, WhatsApp API, Instagram, Facebook, Telegram, WebChat
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('channel_connections', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            connection_name: {
                type: Sequelize.STRING(100),
                allowNull: false,
                comment: 'Nombre descriptivo de la conexión'
            },
            channel_type: {
                type: Sequelize.STRING(30),
                allowNull: false,
                comment: 'Tipo de canal: whatsapp_web, whatsapp_api, instagram_direct, facebook_messenger, telegram, webchat'
            },
            tenant_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'ID del tenant para multitenancy'
            },
            status: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'inactive',
                comment: 'Estado: active, inactive, connecting, disconnected, authenticated, error'
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                comment: 'Si la conexión está habilitada'
            },
            department_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                comment: 'ID del departamento asignado'
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
            channel_config: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: {},
                comment: 'Configuración específica del canal (credenciales, tokens, clientId, etc.)'
            },
            connection_metadata: {
                type: Sequelize.JSONB,
                allowNull: true,
                defaultValue: {},
                comment: 'Metadata de la conexión (QR, estadísticas, device info, etc.)'
            },
            last_seen: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'Última actividad detectada'
            },
            last_error: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Último error registrado'
            },
            connection_attempts: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: 'Número de intentos de reconexión'
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

        // ==================== ÍNDICES ====================

        // Índices básicos
        await queryInterface.addIndex('channel_connections', ['tenant_id'], {
            name: 'idx_channel_connections_tenant'
        });

        await queryInterface.addIndex('channel_connections', ['channel_type'], {
            name: 'idx_channel_connections_channel_type'
        });

        await queryInterface.addIndex('channel_connections', ['status'], {
            name: 'idx_channel_connections_status'
        });

        await queryInterface.addIndex('channel_connections', ['is_active'], {
            name: 'idx_channel_connections_is_active'
        });

        await queryInterface.addIndex('channel_connections', ['department_id'], {
            name: 'idx_channel_connections_department'
        });

        // Índice único: nombre de conexión + tenant
        await queryInterface.addIndex('channel_connections', ['connection_name', 'tenant_id'], {
            unique: true,
            name: 'unique_connection_name_tenant'
        });

        // Índice compuesto para consultas comunes
        await queryInterface.addIndex('channel_connections',
            ['tenant_id', 'channel_type', 'status', 'is_active'],
            {
                name: 'idx_channel_connections_tenant_channel_status_active'
            }
        );

        // Índices GIN para búsqueda en JSONB
        await queryInterface.addIndex('channel_connections', ['channel_config'], {
            using: 'GIN',
            name: 'idx_channel_connections_config_gin'
        });

        await queryInterface.addIndex('channel_connections', ['connection_metadata'], {
            using: 'GIN',
            name: 'idx_channel_connections_metadata_gin'
        });

        // Índice para búsqueda de clientId en WhatsApp
        await queryInterface.sequelize.query(`
            CREATE INDEX idx_channel_config_client_id
            ON channel_connections ((channel_config->>'clientId'))
            WHERE channel_type = 'whatsapp_web';
        `);

        // Índice para búsqueda de phoneNumber en WhatsApp
        await queryInterface.sequelize.query(`
            CREATE INDEX idx_channel_config_phone_number
            ON channel_connections ((channel_config->>'phoneNumber'))
            WHERE channel_type IN ('whatsapp_web', 'whatsapp_api');
        `);

        // ==================== CONSTRAINTS ====================

        // Constraint para validar channel_type
        await queryInterface.sequelize.query(`
            ALTER TABLE channel_connections
            ADD CONSTRAINT valid_channel_type CHECK (channel_type IN (
                'whatsapp_web',
                'whatsapp_api',
                'instagram_direct',
                'facebook_messenger',
                'telegram',
                'webchat'
            ));
        `);

        // Constraint para validar status
        await queryInterface.sequelize.query(`
            ALTER TABLE channel_connections
            ADD CONSTRAINT valid_status CHECK (status IN (
                'active',
                'inactive',
                'connecting',
                'disconnected',
                'authenticated',
                'error'
            ));
        `);

        console.log('✅ Tabla channel_connections creada exitosamente');
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('channel_connections');
        console.log('❌ Tabla channel_connections eliminada');
    }
};