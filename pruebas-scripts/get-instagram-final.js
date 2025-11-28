/**
 * Script FINAL para obtener publicaciones de Instagram
 * API: Instagram Public Bulk Scraper
 *
 * Endpoints disponibles:
 * - /v1/user_info - Info del usuario
 * - /v1/user_info_web - Info del usuario (web)
 * - /v2/user_posts - Posts del usuario
 *
 * Uso:
 * node get-instagram-final.js bcv.org.ve
 */

require('dotenv').config({ path: '.env.development' });
const axios = require('axios');

const CONFIG = {
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
  RAPIDAPI_HOST: process.env.RAPIDAPI_HOST
};

/**
 * Obtiene información del usuario
 */
async function getUserInfo(username) {
  try {
    const url = `https://${CONFIG.RAPIDAPI_HOST}/v1/user_info_web`;

    const response = await axios.get(url, {
      params: {
        username: username
      },
      headers: {
        'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY,
        'X-RapidAPI-Host': CONFIG.RAPIDAPI_HOST
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error obteniendo info del usuario:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Obtiene los posts del usuario (requiere user_id numérico)
 */
async function getUserPosts(userId) {
  try {
    const url = `https://${CONFIG.RAPIDAPI_HOST}/v2/user_posts`;

    const response = await axios.get(url, {
      params: {
        username_or_id: userId
      },
      headers: {
        'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY,
        'X-RapidAPI-Host': CONFIG.RAPIDAPI_HOST
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error obteniendo posts:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Función principal: Obtiene perfil y última publicación
 */
async function getInstagramData(username) {
  try {
    console.log(`📷 Obteniendo información de @${username}...\n`);

    if (!CONFIG.RAPIDAPI_KEY) {
      console.error('❌ Error: RAPIDAPI_KEY no configurado');
      process.exit(1);
    }

    // Paso 1: Obtener información del usuario (incluye user_id)
    console.log('🔄 Paso 1: Obteniendo información del perfil...');
    const userInfo = await getUserInfo(username);

    if (!userInfo || !userInfo.data) {
      console.error('❌ No se pudo obtener información del usuario');
      return null;
    }

    const userData = userInfo.data;

    // Mostrar información del perfil
    console.log('✅ Información obtenida\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('   📊 INFORMACIÓN DEL PERFIL');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`Usuario: @${userData.username || username}`);
    console.log(`Nombre: ${userData.full_name || 'N/A'}`);
    console.log(`ID: ${userData.id}`);

    if (userData.follower_count) {
      console.log(`Seguidores: ${userData.follower_count.toLocaleString()}`);
    }

    if (userData.following_count) {
      console.log(`Siguiendo: ${userData.following_count.toLocaleString()}`);
    }

    if (userData.media_count) {
      console.log(`Publicaciones: ${userData.media_count.toLocaleString()}`);
    }

    if (userData.is_verified) {
      console.log('✓ Cuenta verificada');
    }

    if (userData.biography) {
      console.log(`\nBiografía:\n${userData.biography}`);
    }

    // Paso 2: Obtener posts del usuario
    console.log('\n🔄 Paso 2: Obteniendo publicaciones...');
    const postsData = await getUserPosts(userData.id);

    if (!postsData || !postsData.data || !postsData.data.items) {
      console.log('⚠️  No se pudieron obtener las publicaciones');
      return { user: userData, posts: [] };
    }

    const posts = postsData.data.items;
    console.log(`✅ ${posts.length} publicaciones obtenidas\n`);

    // Mostrar la última publicación
    if (posts.length > 0) {
      const latestPost = posts[0];

      console.log('═══════════════════════════════════════════════════════');
      console.log('   📸 ÚLTIMA PUBLICACIÓN');
      console.log('═══════════════════════════════════════════════════════\n');

      if (latestPost.code) {
        console.log(`🔗 URL: https://www.instagram.com/p/${latestPost.code}/`);
      }

      if (latestPost.taken_at) {
        const date = new Date(latestPost.taken_at * 1000);
        console.log(`📅 Fecha: ${date.toLocaleString('es-ES')}`);
      }

      if (latestPost.like_count) {
        console.log(`❤️  Likes: ${latestPost.like_count.toLocaleString()}`);
      }

      if (latestPost.comment_count) {
        console.log(`💬 Comentarios: ${latestPost.comment_count.toLocaleString()}`);
      }

      if (latestPost.caption) {
        console.log(`\n📝 Caption:`);
        console.log('─────────────────────────────────────────────────────');
        const caption = latestPost.caption.text || latestPost.caption;
        console.log(caption.length > 300 ? caption.substring(0, 300) + '...' : caption);
        console.log('─────────────────────────────────────────────────────');
      }

      // Tipo de media
      if (latestPost.media_type === 2) {
        console.log(`\n🎥 Tipo: Video`);
        if (latestPost.video_versions && latestPost.video_versions[0]) {
          console.log(`📹 Video URL: ${latestPost.video_versions[0].url}`);
        }
      } else if (latestPost.media_type === 8) {
        console.log(`\n🎠 Tipo: Carrusel (múltiples imágenes)`);
      } else {
        console.log(`\n📷 Tipo: Imagen`);
      }

      if (latestPost.image_versions2 && latestPost.image_versions2.candidates) {
        const highestQuality = latestPost.image_versions2.candidates[0];
        console.log(`🖼️  Imagen: ${highestQuality.url}`);
      }

      console.log('\n═══════════════════════════════════════════════════════');
    }

    console.log('\n✅ Datos obtenidos exitosamente\n');

    return {
      user: userData,
      posts: posts,
      latestPost: posts[0] || null
    };

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Datos: ${JSON.stringify(error.response.data, null, 2)}`);

      if (error.response.status === 401) {
        console.error('\n💡 Verifica tu RAPIDAPI_KEY en .env.development');
      } else if (error.response.status === 429) {
        console.error('\n💡 Límite de requests alcanzado. Espera un momento.');
      } else if (error.response.status === 404) {
        console.error('\n💡 Usuario no encontrado');
      }
    }

    return null;
  }
}

async function main() {
  const username = process.argv[2];

  console.log('═══════════════════════════════════════════════════════');
  console.log('   📷 INSTAGRAM - Obtener Última Publicación');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!username) {
    console.log('❌ Falta nombre de usuario\n');
    console.log('Uso: node get-instagram-final.js <username>\n');
    console.log('Ejemplos:');
    console.log('  node get-instagram-final.js bcv.org.ve');
    console.log('  node get-instagram-final.js sooyaaa__');
    console.log('  node get-instagram-final.js walrexapp\n');
    process.exit(1);
  }

  const cleanUsername = username.replace('@', '');
  await getInstagramData(cleanUsername);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error fatal:', error.message);
    process.exit(1);
  });
}

module.exports = { getInstagramData, getUserInfo, getUserPosts };