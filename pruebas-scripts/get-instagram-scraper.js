/**
 * Script para obtener la última publicación de cualquier cuenta pública de Instagram
 * Usando web scraping con axios (sin navegador pesado)
 *
 * ⚠️ IMPORTANTE:
 * - Solo funciona con cuentas públicas
 * - Instagram puede cambiar su estructura en cualquier momento
 * - No abuses de las solicitudes para evitar bloqueos de IP
 * - Este método está en zona gris de los términos de servicio
 *
 * Uso:
 * node get-instagram-scraper.js bcv.org.ve
 */

const axios = require('axios');

/**
 * Obtiene la última publicación de una cuenta de Instagram
 * @param {string} username - Nombre de usuario sin @
 */
async function getLatestInstagramPost(username) {
  try {
    console.log(`📷 Obteniendo última publicación de @${username}...\n`);

    // Instagram expone datos en el HTML como JSON
    const url = `https://www.instagram.com/${username}/`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      }
    });

    const html = response.data;

    // Instagram incrusta los datos en un script tag con JSON
    const regex = /<script type="application\/ld\+json">({.*?})<\/script>/g;
    const matches = [...html.matchAll(regex)];

    if (matches.length === 0) {
      // Intentar con otro patrón (Instagram cambia frecuentemente)
      console.log('⚠️  No se encontró el patrón de datos JSON');
      console.log('💡 Intentando método alternativo...\n');

      // Buscar window._sharedData
      const sharedDataRegex = /window\._sharedData = ({.+?});<\/script>/;
      const sharedDataMatch = html.match(sharedDataRegex);

      if (sharedDataMatch) {
        const sharedData = JSON.parse(sharedDataMatch[1]);
        console.log('✅ Datos encontrados con método alternativo');

        // Navegar por la estructura de sharedData
        const profilePage = sharedData?.entry_data?.ProfilePage;
        if (profilePage && profilePage[0]?.graphql?.user) {
          const user = profilePage[0].graphql.user;
          const edges = user.edge_owner_to_timeline_media?.edges;

          if (edges && edges.length > 0) {
            const latestPost = edges[0].node;
            return formatPostData(latestPost, username);
          }
        }
      }

      console.log('❌ No se pudo extraer datos. Instagram puede haber cambiado su estructura.');
      console.log('💡 Alternativa: Usa la API de RapidAPI o servicios similares.');
      return null;
    }

    // Parsear JSON-LD data
    const jsonLdData = JSON.parse(matches[0][1]);

    console.log('✅ Información de perfil obtenida:\n');
    console.log(`Nombre: ${jsonLdData.name}`);
    console.log(`Usuario: @${jsonLdData.alternateName || username}`);

    if (jsonLdData.interactionStatistic) {
      const followers = jsonLdData.interactionStatistic.find(
        stat => stat.interactionType === 'http://schema.org/FollowAction'
      );
      if (followers) {
        console.log(`Seguidores: ${followers.userInteractionCount}`);
      }
    }

    console.log('\n⚠️  Método JSON-LD solo proporciona info básica del perfil.');
    console.log('Para obtener posts específicos, se requiere scraping más profundo.\n');

    return jsonLdData;

  } catch (error) {
    if (error.response?.status === 404) {
      console.error(`❌ Cuenta @${username} no encontrada`);
    } else if (error.response?.status === 429) {
      console.error('❌ Demasiadas solicitudes. Instagram bloqueó temporalmente tu IP.');
      console.error('💡 Espera unos minutos antes de volver a intentar.');
    } else {
      console.error('❌ Error:', error.message);
    }
    return null;
  }
}

/**
 * Formatea los datos del post
 */
function formatPostData(post, username) {
  const data = {
    id: post.id,
    shortcode: post.shortcode,
    url: `https://www.instagram.com/p/${post.shortcode}/`,
    caption: post.edge_media_to_caption?.edges[0]?.node?.text || '',
    likes: post.edge_liked_by?.count || 0,
    comments: post.edge_media_to_comment?.count || 0,
    timestamp: new Date(post.taken_at_timestamp * 1000).toISOString(),
    is_video: post.is_video,
    media_url: post.display_url,
    thumbnail_url: post.thumbnail_src
  };

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ ÚLTIMA PUBLICACIÓN');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`📅 Fecha: ${new Date(data.timestamp).toLocaleString('es-ES')}`);
  console.log(`🔗 URL: ${data.url}`);
  console.log(`❤️  Likes: ${data.likes.toLocaleString()}`);
  console.log(`💬 Comentarios: ${data.comments.toLocaleString()}`);
  console.log(`📷 Tipo: ${data.is_video ? 'Video' : 'Imagen'}`);
  console.log('\n📄 Caption:');
  console.log('─────────────────────────────────────────────────────');
  console.log(data.caption ? data.caption.substring(0, 300) : '(Sin texto)');
  console.log('─────────────────────────────────────────────────────');
  console.log(`\n🖼️  Imagen: ${data.media_url}`);
  console.log('\n═══════════════════════════════════════════════════════\n');

  return data;
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const username = process.argv[2] || 'bcv.org.ve';

  console.log('═══════════════════════════════════════════════════════');
  console.log('   📷 INSTAGRAM SCRAPER - Última Publicación');
  console.log('═══════════════════════════════════════════════════════\n');

  getLatestInstagramPost(username)
    .then(data => {
      if (data) {
        console.log('✅ Script completado');
      } else {
        console.log('\n⚠️  No se pudo obtener la última publicación.');
        console.log('\n💡 ALTERNATIVAS RECOMENDADAS:\n');
        console.log('1. RapidAPI - Instagram API');
        console.log('   https://rapidapi.com/hub?search=instagram\n');
        console.log('2. Apify - Instagram Scraper');
        console.log('   https://apify.com/apify/instagram-scraper\n');
        console.log('3. Instaloader (Python)');
        console.log('   pip install instaloader\n');
      }
    })
    .catch(err => {
      console.error('Error fatal:', err.message);
      process.exit(1);
    });
}

module.exports = { getLatestInstagramPost };