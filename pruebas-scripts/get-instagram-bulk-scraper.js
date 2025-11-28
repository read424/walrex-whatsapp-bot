/**
 * Script para obtener publicaciones de Instagram usando Instagram Public Bulk Scraper
 *
 * Esta API permite obtener posts de cualquier cuenta pública
 *
 * Uso:
 * node get-instagram-bulk-scraper.js bcv.org.ve
 */

require('dotenv').config({ path: '.env.development' });
const axios = require('axios');

const CONFIG = {
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
  RAPIDAPI_HOST: process.env.RAPIDAPI_HOST
};

/**
 * Obtiene el perfil y posts de un usuario de Instagram
 */
async function getInstagramUserPosts(username) {
  try {
    console.log(`📷 Obteniendo posts de @${username}...\n`);

    if (!CONFIG.RAPIDAPI_KEY) {
      console.error('❌ Error: RAPIDAPI_KEY no configurado');
      process.exit(1);
    }

    // Esta API usa endpoints como /user o /profile
    // Vamos a probar el más común
    const url = `https://${CONFIG.RAPIDAPI_HOST}/user`;

    const response = await axios.get(url, {
      params: {
        username: username
      },
      headers: {
        'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY,
        'X-RapidAPI-Host': CONFIG.RAPIDAPI_HOST
      }
    });

    const data = response.data;

    // Mostrar información del perfil
    console.log('═══════════════════════════════════════════════════════');
    console.log('   📊 INFORMACIÓN DEL PERFIL');
    console.log('═══════════════════════════════════════════════════════\n');

    if (data.user || data.data || data.profile) {
      const userData = data.user || data.data || data.profile;

      console.log(`Usuario: @${userData.username || username}`);
      console.log(`Nombre: ${userData.full_name || userData.name || 'N/A'}`);

      if (userData.follower_count || userData.followers_count || userData.edge_followed_by?.count) {
        const followers = userData.follower_count || userData.followers_count || userData.edge_followed_by?.count;
        console.log(`Seguidores: ${followers.toLocaleString()}`);
      }

      if (userData.following_count || userData.edge_follow?.count) {
        const following = userData.following_count || userData.edge_follow?.count;
        console.log(`Siguiendo: ${following.toLocaleString()}`);
      }

      if (userData.media_count || userData.edge_owner_to_timeline_media?.count) {
        const posts = userData.media_count || userData.edge_owner_to_timeline_media?.count;
        console.log(`Publicaciones: ${posts.toLocaleString()}`);
      }

      if (userData.is_verified) {
        console.log('✓ Cuenta verificada');
      }

      if (userData.biography || userData.bio) {
        console.log(`\nBiografía:\n${userData.biography || userData.bio}`);
      }
    }

    // Mostrar última publicación si está disponible
    const posts = data.posts || data.media || data.edge_owner_to_timeline_media?.edges;

    if (posts && posts.length > 0) {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('   📸 ÚLTIMA PUBLICACIÓN');
      console.log('═══════════════════════════════════════════════════════\n');

      const latestPost = posts[0].node || posts[0];

      if (latestPost.shortcode) {
        console.log(`🔗 URL: https://www.instagram.com/p/${latestPost.shortcode}/`);
      }

      if (latestPost.edge_media_to_caption?.edges[0]?.node?.text || latestPost.caption) {
        const caption = latestPost.edge_media_to_caption?.edges[0]?.node?.text || latestPost.caption;
        console.log(`\n📝 Caption:\n${caption.substring(0, 300)}${caption.length > 300 ? '...' : ''}`);
      }

      if (latestPost.edge_liked_by?.count || latestPost.like_count) {
        const likes = latestPost.edge_liked_by?.count || latestPost.like_count;
        console.log(`\n❤️  Likes: ${likes.toLocaleString()}`);
      }

      if (latestPost.edge_media_to_comment?.count || latestPost.comment_count) {
        const comments = latestPost.edge_media_to_comment?.count || latestPost.comment_count;
        console.log(`💬 Comentarios: ${comments.toLocaleString()}`);
      }

      if (latestPost.taken_at_timestamp || latestPost.timestamp) {
        const timestamp = latestPost.taken_at_timestamp || latestPost.timestamp;
        const date = new Date(timestamp * 1000);
        console.log(`📅 Fecha: ${date.toLocaleString('es-ES')}`);
      }

      if (latestPost.display_url || latestPost.thumbnail_src) {
        console.log(`\n🖼️  Imagen: ${latestPost.display_url || latestPost.thumbnail_src}`);
      }

      if (latestPost.is_video) {
        console.log(`🎥 Tipo: Video`);
        if (latestPost.video_url) {
          console.log(`📹 Video URL: ${latestPost.video_url}`);
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Datos obtenidos exitosamente\n');

    return data;

  } catch (error) {
    console.error('\n❌ Error al obtener datos:\n');

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Mensaje: ${JSON.stringify(error.response.data, null, 2)}`);

      if (error.response.status === 401) {
        console.error('\n💡 Verifica tu RAPIDAPI_KEY');
      } else if (error.response.status === 404) {
        console.error('\n💡 Usuario no encontrado o endpoint incorrecto');
        console.error('   Intentemos con otro endpoint...');
        return await tryAlternativeEndpoints(username);
      } else if (error.response.status === 429) {
        console.error('\n💡 Límite de requests alcanzado');
      }
    } else {
      console.error(error.message);
    }

    return null;
  }
}

/**
 * Intenta con endpoints alternativos
 */
async function tryAlternativeEndpoints(username) {
  const endpoints = [
    { path: '/profile', param: 'username' },
    { path: '/userinfo', param: 'username' },
    { path: '/get_user', param: 'user' },
    { path: '/instagram/user', param: 'username' }
  ];

  console.log('\n🔄 Probando endpoints alternativos...\n');

  for (const endpoint of endpoints) {
    try {
      console.log(`Probando: ${endpoint.path}`);

      const url = `https://${CONFIG.RAPIDAPI_HOST}${endpoint.path}`;
      const params = {};
      params[endpoint.param] = username;

      const response = await axios.get(url, {
        params: params,
        headers: {
          'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY,
          'X-RapidAPI-Host': CONFIG.RAPIDAPI_HOST
        }
      });

      console.log('✅ Funcionó!\n');
      console.log('Datos recibidos:');
      console.log(JSON.stringify(response.data, null, 2));

      return response.data;

    } catch (error) {
      console.log(`❌ No funciona: ${error.response?.status || error.message}`);
    }
  }

  console.error('\n❌ Ningún endpoint funcionó');
  console.error('\n💡 Recomendación:');
  console.error('   Revisa la documentación de la API en RapidAPI');
  console.error(`   https://rapidapi.com/hub?search=instagram`);

  return null;
}

async function main() {
  const username = process.argv[2];

  console.log('═══════════════════════════════════════════════════════');
  console.log('   📷 INSTAGRAM PUBLIC BULK SCRAPER');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!username) {
    console.log('❌ Falta nombre de usuario\n');
    console.log('Uso: node get-instagram-bulk-scraper.js <username>\n');
    console.log('Ejemplo:');
    console.log('  node get-instagram-bulk-scraper.js bcv.org.ve\n');
    process.exit(1);
  }

  const cleanUsername = username.replace('@', '');
  await getInstagramUserPosts(cleanUsername);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error fatal:', error.message);
    process.exit(1);
  });
}

module.exports = { getInstagramUserPosts };