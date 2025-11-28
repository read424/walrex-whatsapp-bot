/**
 * Script para obtener información de un post de Instagram usando su URL
 * API: Instagram Scraper Stable API
 *
 * Esta API requiere la URL completa del post, no solo el username
 *
 * Uso:
 * node get-instagram-post-by-url.js https://www.instagram.com/p/DLUWkieNc0u/
 * node get-instagram-post-by-url.js DLUWkieNc0u
 */

require('dotenv').config({ path: '.env.development' });
const axios = require('axios');

const CONFIG = {
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
  RAPIDAPI_HOST: process.env.RAPIDAPI_HOST
};

/**
 * Obtiene información de un post de Instagram por URL o código
 */
async function getInstagramPost(postUrlOrCode) {
  try {
    // Convertir código a URL si es necesario
    let postUrl = postUrlOrCode;

    if (!postUrl.startsWith('http')) {
      // Si solo es el código (ej: DLUWkieNc0u), construir URL completa
      postUrl = `https://www.instagram.com/p/${postUrl}/`;
    }

    console.log(`📷 Obteniendo información del post...\n`);
    console.log(`URL: ${postUrl}\n`);

    if (!CONFIG.RAPIDAPI_KEY) {
      console.error('❌ Error: RAPIDAPI_KEY no configurado en .env.development');
      process.exit(1);
    }

    // Endpoint de la API
    const apiUrl = `https://${CONFIG.RAPIDAPI_HOST}/get_reel_title.php`;

    const response = await axios.get(apiUrl, {
      params: {
        reel_post_code_or_url: postUrl,
        type: 'post'
      },
      headers: {
        'x-rapidapi-host': CONFIG.RAPIDAPI_HOST,
        'x-rapidapi-key': CONFIG.RAPIDAPI_KEY
      }
    });

    const data = response.data;

    // Mostrar información
    console.log('═══════════════════════════════════════════════════════');
    console.log('   📸 INFORMACIÓN DEL POST');
    console.log('═══════════════════════════════════════════════════════\n');

    if (data.success || data.data) {
      const postData = data.data || data;

      console.log(`📝 Caption: ${postData.title || postData.caption || 'Sin texto'}`);

      if (postData.owner || postData.username) {
        console.log(`👤 Usuario: @${postData.owner || postData.username}`);
      }

      if (postData.likes || postData.like_count) {
        console.log(`❤️  Likes: ${(postData.likes || postData.like_count).toLocaleString()}`);
      }

      if (postData.comments || postData.comment_count) {
        console.log(`💬 Comentarios: ${(postData.comments || postData.comment_count).toLocaleString()}`);
      }

      if (postData.timestamp || postData.taken_at) {
        const date = new Date((postData.timestamp || postData.taken_at) * 1000);
        console.log(`📅 Fecha: ${date.toLocaleString('es-ES')}`);
      }

      if (postData.video_url) {
        console.log(`🎥 Tipo: Video`);
        console.log(`📹 Video URL: ${postData.video_url}`);
      } else if (postData.display_url || postData.image_url) {
        console.log(`📷 Tipo: Imagen`);
        console.log(`🖼️  Imagen: ${postData.display_url || postData.image_url}`);
      }

      console.log('\n═══════════════════════════════════════════════════════');
      console.log('\n✅ Datos obtenidos exitosamente\n');

      // Mostrar datos completos en formato JSON
      console.log('📋 Datos completos (JSON):');
      console.log(JSON.stringify(data, null, 2));

      return data;

    } else {
      console.log('⚠️  No se pudieron obtener los datos del post');
      console.log('\nRespuesta de la API:');
      console.log(JSON.stringify(data, null, 2));
      return null;
    }

  } catch (error) {
    console.error('\n❌ Error al obtener el post:\n');

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Mensaje: ${JSON.stringify(error.response.data, null, 2)}`);

      if (error.response.status === 401) {
        console.error('\n💡 Error de autenticación:');
        console.error('   - Verifica que tu RAPIDAPI_KEY sea correcta');
        console.error('   - Asegúrate de estar suscrito a la API');
      } else if (error.response.status === 429) {
        console.error('\n💡 Límite de requests alcanzado:');
        console.error('   - Espera un momento antes de volver a intentar');
      } else if (error.response.status === 404) {
        console.error('\n💡 Post no encontrado:');
        console.error('   - Verifica que la URL sea correcta');
        console.error('   - Asegúrate que el post sea público');
      }
    } else {
      console.error(error.message);
    }

    process.exit(1);
  }
}

async function main() {
  const postInput = process.argv[2];

  console.log('═══════════════════════════════════════════════════════');
  console.log('   📷 INSTAGRAM POST - Obtener Información');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!postInput) {
    console.log('❌ Falta URL o código del post\n');
    console.log('Uso: node get-instagram-post-by-url.js <URL_O_CODIGO>\n');
    console.log('Ejemplos:');
    console.log('  node get-instagram-post-by-url.js https://www.instagram.com/p/DLUWkieNc0u/');
    console.log('  node get-instagram-post-by-url.js DLUWkieNc0u');
    console.log('');
    console.log('⚠️  NOTA IMPORTANTE:');
    console.log('   Esta API requiere la URL o código del post específico.');
    console.log('   No puede obtener "la última publicación" de un usuario automáticamente.');
    console.log('   Necesitas la URL del post que quieres consultar.\n');
    process.exit(1);
  }

  await getInstagramPost(postInput);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error fatal:', error.message);
    process.exit(1);
  });
}

module.exports = { getInstagramPost };