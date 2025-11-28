/**
 * Script simplificado para obtener la URL de la imagen de la última publicación
 *
 * Uso:
 * node get-latest-instagram-image.js bcv.org.ve
 *
 * Retorna solo la URL de la imagen en alta calidad
 */

require('dotenv').config({ path: '.env.development' });
const axios = require('axios');

const CONFIG = {
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
  RAPIDAPI_HOST: process.env.RAPIDAPI_HOST
};

/**
 * Obtiene la URL de la imagen de la última publicación
 * @param {string} username - Usuario de Instagram (sin @)
 * @returns {Object} { imageUrl, postUrl, caption, date }
 */
async function getLatestImage(username) {
  try {
    // Paso 1: Obtener user_id
    const userInfoUrl = `https://${CONFIG.RAPIDAPI_HOST}/v1/user_info_web`;
    const userResponse = await axios.get(userInfoUrl, {
      params: { username },
      headers: {
        'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY,
        'X-RapidAPI-Host': CONFIG.RAPIDAPI_HOST
      }
    });

    if (!userResponse.data?.data?.id) {
      throw new Error('No se pudo obtener el ID del usuario');
    }

    const userId = userResponse.data.data.id;

    // Paso 2: Obtener posts
    const postsUrl = `https://${CONFIG.RAPIDAPI_HOST}/v2/user_posts`;
    const postsResponse = await axios.get(postsUrl, {
      params: { username_or_id: userId },
      headers: {
        'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY,
        'X-RapidAPI-Host': CONFIG.RAPIDAPI_HOST
      }
    });

    if (!postsResponse.data?.data?.items || postsResponse.data.data.items.length === 0) {
      throw new Error('No se encontraron publicaciones');
    }

    const latestPost = postsResponse.data.data.items[0];

    // Extraer la URL de la imagen en la mejor calidad
    let imageUrl = null;

    // Si es un carrusel, obtener la primera imagen
    if (latestPost.carousel_media && latestPost.carousel_media.length > 0) {
      const firstMedia = latestPost.carousel_media[0];
      imageUrl = firstMedia.image_versions2?.candidates[0]?.url;
    }
    // Si es imagen única
    else if (latestPost.image_versions2?.candidates) {
      imageUrl = latestPost.image_versions2.candidates[0].url;
    }

    if (!imageUrl) {
      throw new Error('No se pudo extraer la URL de la imagen');
    }

    // Construir respuesta
    const result = {
      imageUrl: imageUrl,
      postUrl: `https://www.instagram.com/p/${latestPost.code}/`,
      caption: latestPost.caption?.text || '',
      date: new Date(latestPost.taken_at * 1000).toISOString(),
      dateLocal: new Date(latestPost.taken_at * 1000).toLocaleString('es-ES'),
      likes: latestPost.like_count || 0,
      comments: latestPost.comment_count || 0,
      isCarousel: !!latestPost.carousel_media,
      totalImages: latestPost.carousel_media?.length || 1
    };

    return result;

  } catch (error) {
    throw new Error(`Error obteniendo imagen: ${error.message}`);
  }
}

/**
 * Descarga la imagen y la guarda localmente
 */
async function downloadImage(imageUrl, outputPath) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'stream'
    });

    const fs = require('fs');
    const writer = fs.createWriteStream(outputPath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(outputPath));
      writer.on('error', reject);
    });

  } catch (error) {
    throw new Error(`Error descargando imagen: ${error.message}`);
  }
}

async function main() {
  const username = process.argv[2];
  const downloadFlag = process.argv.includes('--download');

  console.log('═══════════════════════════════════════════════════════');
  console.log('   📸 Obtener Última Imagen de Instagram');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!username) {
    console.log('❌ Falta nombre de usuario\n');
    console.log('Uso: node get-latest-instagram-image.js <username> [--download]\n');
    console.log('Ejemplos:');
    console.log('  node get-latest-instagram-image.js bcv.org.ve');
    console.log('  node get-latest-instagram-image.js bcv.org.ve --download\n');
    process.exit(1);
  }

  if (!CONFIG.RAPIDAPI_KEY) {
    console.error('❌ RAPIDAPI_KEY no configurado en .env.development');
    process.exit(1);
  }

  try {
    console.log(`🔍 Buscando última publicación de @${username}...\n`);

    const result = await getLatestImage(username);

    console.log('✅ Imagen encontrada!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Información:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`📅 Fecha: ${result.dateLocal}`);
    console.log(`🔗 Post: ${result.postUrl}`);
    console.log(`❤️  Likes: ${result.likes.toLocaleString()}`);
    console.log(`💬 Comentarios: ${result.comments}`);

    if (result.isCarousel) {
      console.log(`🎠 Carrusel: ${result.totalImages} imágenes`);
    }

    if (result.caption) {
      const shortCaption = result.caption.length > 100
        ? result.caption.substring(0, 100) + '...'
        : result.caption;
      console.log(`\n📝 Caption: ${shortCaption}`);
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🖼️  URL de la imagen:');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(result.imageUrl);
    console.log('\n═══════════════════════════════════════════════════════\n');

    // Descargar si se solicitó
    if (downloadFlag) {
      const fs = require('fs');
      const path = require('path');

      const filename = `instagram_${username}_${Date.now()}.jpg`;
      const outputPath = path.join(__dirname, filename);

      console.log(`📥 Descargando imagen...`);

      await downloadImage(result.imageUrl, outputPath);

      console.log(`✅ Imagen guardada en: ${outputPath}\n`);
    }

    // Para uso programático, retornar JSON si se solicita
    if (process.argv.includes('--json')) {
      console.log('JSON:');
      console.log(JSON.stringify(result, null, 2));
    }

    return result;

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);

    if (error.message.includes('401')) {
      console.error('💡 Verifica tu RAPIDAPI_KEY');
    } else if (error.message.includes('429')) {
      console.error('💡 Límite de requests alcanzado. Espera unos minutos.');
    } else if (error.message.includes('No se pudo obtener el ID')) {
      console.error('💡 Usuario no encontrado o cuenta privada');
    }

    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

// Exportar para uso en otros módulos
module.exports = {
  getLatestImage,
  downloadImage
};