/**
 * Obtener información de un post específico de Instagram usando oEmbed
 * No requiere autenticación ni API keys
 *
 * Limitación: Necesitas la URL del post, no obtiene "último post" automáticamente
 */

const axios = require('axios');

async function getInstagramPostByUrl(postUrl) {
  try {
    console.log(`📷 Obteniendo información del post...\n${postUrl}\n`);

    const oembedUrl = 'https://graph.facebook.com/v21.0/instagram_oembed';

    const response = await axios.get(oembedUrl, {
      params: {
        url: postUrl,
        access_token: '1862490137671684|1be49a50167eeed02bd801255b44062d', // App ID + Secret
        fields: 'author_name,author_url,provider_name,provider_url,thumbnail_url,thumbnail_width,thumbnail_height,title'
      }
    });

    console.log('✅ Información obtenida:\n');
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Ejemplo de uso
const examplePostUrl = 'https://www.instagram.com/p/EXAMPLE_POST_ID/';
console.log('💡 Ejemplo de uso:');
console.log('Para obtener info de un post, usa la URL completa del post\n');

// Descomentar para probar:
// getInstagramPostByUrl(examplePostUrl);

module.exports = { getInstagramPostByUrl };
