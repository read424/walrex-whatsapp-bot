/**
 * Script para obtener la última publicación de una cuenta de Instagram Business
 *
 * Requisitos:
 * - Cuenta de Instagram configurada como Business
 * - Tokens configurados en .env.development
 *
 * Uso:
 * node get-instagram-latest-post.js
 */

require('dotenv').config({ path: '.env.development' });
const axios = require('axios');

// Configuración desde .env
const CONFIG = {
  INSTAGRAM_ACCOUNT_ID: process.env.INSTAGRAM_ACCOUNT_ID,
  INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
  GRAPH_API_VERSION: 'v21.0'
};

/**
 * Obtiene la última publicación de Instagram
 */
async function getLatestPost() {
  try {
    console.log('📸 Obteniendo última publicación de Instagram...\n');
    console.log(`Cuenta: @${process.env.INSTAGRAM_USERNAME || 'walrexapp'}`);
    console.log(`ID: ${CONFIG.INSTAGRAM_ACCOUNT_ID}\n`);

    // Validar configuración
    if (!CONFIG.INSTAGRAM_ACCOUNT_ID || !CONFIG.INSTAGRAM_ACCESS_TOKEN) {
      console.error('❌ Error: Faltan credenciales de Instagram en .env.development');
      console.error('Asegúrate de tener:');
      console.error('  - INSTAGRAM_ACCOUNT_ID');
      console.error('  - INSTAGRAM_ACCESS_TOKEN');
      process.exit(1);
    }

    // Hacer solicitud a la API
    const url = `https://graph.facebook.com/${CONFIG.GRAPH_API_VERSION}/${CONFIG.INSTAGRAM_ACCOUNT_ID}/media`;

    const params = {
      fields: [
        'id',
        'caption',
        'media_type',
        'media_url',
        'permalink',
        'thumbnail_url',
        'timestamp',
        'username',
        'like_count',
        'comments_count'
      ].join(','),
      limit: 1,
      access_token: CONFIG.INSTAGRAM_ACCESS_TOKEN
    };

    const response = await axios.get(url, { params });

    // Verificar si hay publicaciones
    if (!response.data.data || response.data.data.length === 0) {
      console.log('⚠️  No se encontraron publicaciones en esta cuenta.');
      return null;
    }

    const post = response.data.data[0];

    // Mostrar información de la publicación
    console.log('✅ Última publicación encontrada:\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📅 Fecha: ${new Date(post.timestamp).toLocaleString('es-ES')}`);
    console.log(`🔗 URL: ${post.permalink}`);
    console.log(`📝 Tipo: ${post.media_type}`);

    if (post.like_count !== undefined) {
      console.log(`❤️  Likes: ${post.like_count}`);
    }

    if (post.comments_count !== undefined) {
      console.log(`💬 Comentarios: ${post.comments_count}`);
    }

    console.log('\n📄 Caption:');
    console.log('─────────────────────────────────────────────────────');
    if (post.caption) {
      // Limitar caption a 300 caracteres para mejor visualización
      const caption = post.caption.length > 300
        ? post.caption.substring(0, 300) + '...'
        : post.caption;
      console.log(caption);
    } else {
      console.log('(Sin texto)');
    }

    console.log('─────────────────────────────────────────────────────');

    if (post.media_type === 'IMAGE') {
      console.log(`\n🖼️  Imagen: ${post.media_url}`);
    } else if (post.media_type === 'VIDEO') {
      console.log(`\n🎥 Video: ${post.media_url}`);
      if (post.thumbnail_url) {
        console.log(`📸 Thumbnail: ${post.thumbnail_url}`);
      }
    } else if (post.media_type === 'CAROUSEL_ALBUM') {
      console.log(`\n🎠 Carrusel (múltiples imágenes)`);
    }

    console.log('\n═══════════════════════════════════════════════════════\n');

    // Retornar el objeto completo para uso programático
    return post;

  } catch (error) {
    console.error('❌ Error al obtener la publicación:\n');

    if (error.response?.data) {
      const errorData = error.response.data.error;
      console.error(`Tipo: ${errorData.type}`);
      console.error(`Código: ${errorData.code}`);
      console.error(`Mensaje: ${errorData.message}`);

      // Sugerencias según el tipo de error
      if (errorData.code === 10) {
        console.error('\n💡 Sugerencia: Falta permiso "instagram_basic" o "pages_read_engagement"');
        console.error('   Ve a: https://developers.facebook.com/tools/explorer/');
        console.error('   Y solicita los permisos necesarios.');
      } else if (errorData.code === 190) {
        console.error('\n💡 Sugerencia: El token de acceso expiró o es inválido');
        console.error('   Ejecuta: node get-meta-tokens.js');
      } else if (errorData.code === 100) {
        console.error('\n💡 Sugerencia: El ID de la cuenta es inválido');
        console.error('   Verifica INSTAGRAM_ACCOUNT_ID en .env.development');
      }

      if (errorData.fbtrace_id) {
        console.error(`\nTrace ID: ${errorData.fbtrace_id}`);
      }
    } else {
      console.error(error.message);
    }

    process.exit(1);
  }
}

/**
 * Función para obtener información de la cuenta
 */
async function getAccountInfo() {
  try {
    const url = `https://graph.facebook.com/${CONFIG.GRAPH_API_VERSION}/${CONFIG.INSTAGRAM_ACCOUNT_ID}`;

    const params = {
      fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url',
      access_token: CONFIG.INSTAGRAM_ACCESS_TOKEN
    };

    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    return null;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   📷 INSTAGRAM - Obtener Última Publicación');
  console.log('═══════════════════════════════════════════════════════\n');

  // Opcional: Mostrar info de la cuenta primero
  const accountInfo = await getAccountInfo();
  if (accountInfo) {
    console.log('📊 Información de la cuenta:');
    console.log(`   Usuario: @${accountInfo.username}`);
    console.log(`   Nombre: ${accountInfo.name}`);
    if (accountInfo.followers_count !== undefined) {
      console.log(`   Seguidores: ${accountInfo.followers_count.toLocaleString()}`);
    }
    if (accountInfo.media_count !== undefined) {
      console.log(`   Publicaciones: ${accountInfo.media_count.toLocaleString()}`);
    }
    console.log('');
  }

  // Obtener última publicación
  const post = await getLatestPost();

  if (post) {
    console.log('✅ Script ejecutado correctamente');

    // Para uso programático: retornar el post
    return post;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
}

// Exportar funciones para uso en otros módulos
module.exports = {
  getLatestPost,
  getAccountInfo
};