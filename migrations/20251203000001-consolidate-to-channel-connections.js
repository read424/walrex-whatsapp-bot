/**
 * Migración: Consolidar connections y whatsapp_connections en channel_connections
 * 
 * Esta migración:
 * 1. Migra datos de 'connections' y 'whatsapp_connections' a 'channel_connections'
 * 2. Actualiza referencias en tablas relacionadas (chat_sessions)
 * 3. Prepara para eliminar tablas antiguas (comentado por seguridad)
 * 
 * IMPORTANTE: Hacer backup antes de ejecutar
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Starting data migration to channel_connections...');

      // 1. Verificar que channel_connections existe
      const tableExists = await queryInterface.sequelize.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'channel_connections'
        );`,
        { transaction }
      );

      if (!tableExists[0][0].exists) {
        throw new Error('Table channel_connections does not exist. Run create-channel-connections migration first.');
      }

      // 2. Migrar datos de connections + whatsapp_connections a channel_connections
      await queryInterface.sequelize.query(`
        INSERT INTO channel_connections (
          connection_name,
          channel_type,
          tenant_id,
          status,
          is_active,
          channel_config,
          connection_metadata,
          last_seen,
          last_error,
          connection_attempts,
          department_id,
          welcome_message,
          goodbye_message,
          chatbot_timeout,
          created_at,
          updated_at
        )
        SELECT 
          c.connection_name,
          -- Convertir provider_type a channel_type (cast a text primero para evitar error de enum)
          CASE 
            WHEN c.provider_type::text = 'whatsapp' THEN 'whatsapp_web'
            WHEN c.provider_type::text = 'whatsapp_api' THEN 'whatsapp_api'
            WHEN c.provider_type::text = 'facebook' THEN 'facebook_messenger'
            WHEN c.provider_type::text = 'instagram' THEN 'instagram_direct'
            WHEN c.provider_type::text = 'telegram' THEN 'telegram'
            WHEN c.provider_type::text = 'chatweb' THEN 'webchat'
            ELSE 'whatsapp_web'  -- Default fallback
          END as channel_type,
          c.tenant_id,
          -- Convertir status (cast a text primero)
          CASE 
            WHEN c.status::text = 'active' THEN 'active'
            WHEN c.status::text = 'inactive' THEN 'inactive'
            WHEN c.status::text = 'connecting' THEN 'connecting'
            WHEN c.status::text = 'error' THEN 'error'
            ELSE 'disconnected'
          END as status,
          c.is_active,
          -- Migrar settings a channel_config (convertir JSON a JSONB correctamente)
          COALESCE(to_jsonb(c.settings), '{}'::jsonb) as channel_config,
          -- Construir connection_metadata desde whatsapp_connections
          CASE 
            WHEN wc.id IS NOT NULL THEN
              jsonb_build_object(
                'phoneNumber', wc.phone_number,
                'qrCode', wc.qr_code,
                'deviceInfo', COALESCE(wc.device_info, '{}'::jsonb),
                'migratedFrom', 'whatsapp_connections',
                'originalClientId', wc.client_id
              )
            ELSE '{}'::jsonb
          END as connection_metadata,
          COALESCE(wc.last_seen, c.updated_at) as last_seen,
          wc.last_error,
          COALESCE(wc.connection_attempts, 0) as connection_attempts,
          c.department,
          c.welcome_message,
          c.goodbye_message,
          c.chatbot_timeout,
          c.created_at,
          GREATEST(c.updated_at, COALESCE(wc.updated_at, c.updated_at)) as updated_at
        FROM connections c
        LEFT JOIN whatsapp_connections wc ON wc.connection_id = c.id
        WHERE NOT EXISTS (
          SELECT 1 FROM channel_connections cc 
          WHERE cc.connection_name = c.connection_name 
          AND cc.tenant_id = c.tenant_id
        )
        ORDER BY c.id;
      `, { transaction });

      const migratedCount = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM channel_connections WHERE connection_metadata->>'migratedFrom' = 'whatsapp_connections';`,
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      console.log(`✅ Migrated ${migratedCount[0].count} connections to channel_connections`);

      // 3. Actualizar referencias en chat_sessions
      console.log('🔄 Updating chat_sessions references...');

      await queryInterface.sequelize.query(`
        UPDATE chat_sessions cs
        SET connection_id = cc.id
        FROM channel_connections cc
        JOIN connections c ON c.connection_name = cc.connection_name AND c.tenant_id = cc.tenant_id
        WHERE cs.connection_id = c.id
        AND cc.connection_metadata->>'migratedFrom' = 'whatsapp_connections';
      `, { transaction });

      console.log('✅ Updated chat_sessions references');

      // 4. Crear tabla de mapeo temporal para backward compatibility (opcional)
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS connection_id_mapping (
          old_connection_id INTEGER,
          old_whatsapp_connection_id INTEGER,
          new_channel_connection_id INTEGER,
          connection_name VARCHAR(100),
          migrated_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (old_connection_id)
        );
      `, { transaction });

      await queryInterface.sequelize.query(`
        INSERT INTO connection_id_mapping (
          old_connection_id,
          old_whatsapp_connection_id,
          new_channel_connection_id,
          connection_name
        )
        SELECT 
          c.id,
          wc.id,
          cc.id,
          c.connection_name
        FROM connections c
        LEFT JOIN whatsapp_connections wc ON wc.connection_id = c.id
        JOIN channel_connections cc ON cc.connection_name = c.connection_name AND cc.tenant_id = c.tenant_id
        WHERE cc.connection_metadata->>'migratedFrom' = 'whatsapp_connections';
      `, { transaction });

      console.log('✅ Created connection_id_mapping table for backward compatibility');

      await transaction.commit();

      console.log('✅ Migration completed successfully!');
      console.log('');
      console.log('⚠️  NEXT STEPS:');
      console.log('1. Test the application thoroughly');
      console.log('2. Verify all connections work correctly');
      console.log('3. After confirming everything works, you can drop old tables:');
      console.log('   - DROP TABLE whatsapp_connections CASCADE;');
      console.log('   - DROP TABLE connections CASCADE;');
      console.log('   - DROP TABLE connection_id_mapping;');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back migration...');

      // Restaurar datos a connections y whatsapp_connections
      await queryInterface.sequelize.query(`
        INSERT INTO connections (
          id,
          connection_name,
          provider_type,
          tenant_id,
          status,
          is_active,
          settings,
          department,
          welcome_message,
          goodbye_message,
          chatbot_timeout,
          created_at,
          updated_at
        )
        SELECT 
          cim.old_connection_id,
          cc.connection_name,
          CASE 
            WHEN cc.channel_type = 'whatsapp_web' THEN 'whatsapp'
            WHEN cc.channel_type = 'whatsapp_api' THEN 'whatsapp_api'
            WHEN cc.channel_type = 'facebook_messenger' THEN 'facebook'
            WHEN cc.channel_type = 'instagram_direct' THEN 'instagram'
            WHEN cc.channel_type = 'telegram' THEN 'telegram'
            WHEN cc.channel_type = 'webchat' THEN 'chatweb'
            ELSE cc.channel_type
          END,
          cc.tenant_id,
          cc.status,
          cc.is_active,
          cc.channel_config::json,
          cc.department_id,
          cc.welcome_message,
          cc.goodbye_message,
          cc.chatbot_timeout,
          cc.created_at,
          cc.updated_at
        FROM channel_connections cc
        JOIN connection_id_mapping cim ON cim.new_channel_connection_id = cc.id
        WHERE cc.connection_metadata->>'migratedFrom' = 'whatsapp_connections';
      `, { transaction });

      await queryInterface.sequelize.query(`
        INSERT INTO whatsapp_connections (
          id,
          client_id,
          tenant_id,
          phone_number,
          status,
          last_seen,
          qr_code,
          device_info,
          connection_attempts,
          last_error,
          is_active,
          connection_id,
          created_at,
          updated_at
        )
        SELECT 
          cim.old_whatsapp_connection_id,
          cc.connection_metadata->>'originalClientId',
          cc.tenant_id,
          cc.connection_metadata->>'phoneNumber',
          cc.status,
          cc.last_seen,
          cc.connection_metadata->>'qrCode',
          (cc.connection_metadata->'deviceInfo')::jsonb,
          cc.connection_attempts,
          cc.last_error,
          cc.is_active,
          cim.old_connection_id,
          cc.created_at,
          cc.updated_at
        FROM channel_connections cc
        JOIN connection_id_mapping cim ON cim.new_channel_connection_id = cc.id
        WHERE cc.connection_metadata->>'migratedFrom' = 'whatsapp_connections'
        AND cim.old_whatsapp_connection_id IS NOT NULL;
      `, { transaction });

      // Restaurar referencias en chat_sessions
      await queryInterface.sequelize.query(`
        UPDATE chat_sessions cs
        SET connection_id = cim.old_connection_id
        FROM connection_id_mapping cim
        WHERE cs.connection_id = cim.new_channel_connection_id;
      `, { transaction });

      // Eliminar datos migrados de channel_connections
      await queryInterface.sequelize.query(`
        DELETE FROM channel_connections 
        WHERE connection_metadata->>'migratedFrom' = 'whatsapp_connections';
      `, { transaction });

      // Eliminar tabla de mapeo
      await queryInterface.dropTable('connection_id_mapping', { transaction });

      await transaction.commit();
      console.log('✅ Rollback completed successfully');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
