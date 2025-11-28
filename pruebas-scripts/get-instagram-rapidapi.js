/**
 * Script para obtener publicaciones de Instagram usando RapidAPI
 *
 * Requisitos:
 * 1. Cuenta en RapidAPI: https://rapidapi.com/signup
 * 2. Suscribirse a una API de Instagram (hay varias opciones gratuitas)
 * 3. Obtener tu API Key
 * 4. Agregar a .env.development:
 *    RAPIDAPI_KEY=tu_api_key_aqui
 *    RAPIDAPI_HOST=instagram-scraper-api2.p.rapidapi.com
 *
 * APIs recomendadas en RapidAPI:
 * - Instagram Scraper API2: https://rapidapi.com/restyler/api/instagram-scraper-api2
 * - Instagram Data API: https://rapidapi.com/viralinfotech/api/instagram-data1
 *
 * Uso:
 * node get-instagram-rapidapi.js bcv.org.ve
 */

require('dotenv').config({ path: '.env.development' });
const axios = require('axios');

const CONFIG = {
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
  RAPIDAPI_HOST: process.env.RAPIDAPI_HOST || 'instagram-scraper-api2.p.rapidapi.com'
};

/**
 * Obtiene información de perfil y última publicación usando RapidAPI
 */
async function getInstagramProfile(username) {
  try {
    console.log(`📷 Obteniendo perfil e información de @${username}...\n`);

    if (!CONFIG.RAPIDAPI_KEY) {
      console.error('❌ Error: RAPIDAPI_KEY no configurado en .env.development\n');
      console.log('📋 Pasos para configurar:');
      console.log('1. Crear cuenta en: https://rapidapi.com/signup');
      console.log('2. Suscribirse a una API de Instagram');
      console.log('3. Copiar tu API Key');
      console.log('4. Agregar a .env.development:');
      console.log('   RAPIDAPI_KEY=tu_api_key_aqui\n');
      process.exit(1);
    }

    // Endpoint para obtener perfil (varía según la API que uses)
    const url = `https://${CONFIG.RAPIDAPI_HOST}/v1/info`;

    const options = {
      method: 'GET',
      url: url,
      params: {
        username_or_id_or_url: username
      },
      headers: {
        'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY,
        'X-RapidAPI-Host': CONFIG.RAPIDAPI_HOST
      }
    };

    const response = await axios.request(options);
    const data = response.data;

    // Mostrar información
    console.log('═══════════════════════════════════════════════════════');
    console.log('   📊 INFORMACIÓN DEL PERFIL');
    console.log('═══════════════════════════════════════════════════════\n');

    if (data.user || data.data) {
      const userData = data.user || data.data;

      console.log(`Usuario: @${userData.username || username}`);
      console.log(`Nombre: ${userData.full_name || userData.name || 'N/A'}`);

      if (userData.follower_count || userData.followers_count) {
        console.log(`Seguidores: ${(userData.follower_count || userData.followers_count).toLocaleString()}`);
      }

      if (userData.following_count || userData.followings_count) {
        console.log(`Siguiendo: ${(userData.following_count || userData.followings_count).toLocaleString()}`);
      }

      if (userData.media_count || userData.posts_count) {
        console.log(`Publicaciones: ${(userData.media_count || userData.posts_count).toLocaleString()}`);
      }

      if (userData.is_verified) {
        console.log('✓ Cuenta verificada');
      }

      if (userData.biography || userData.bio) {
        console.log(`\nBiografía:\n${userData.biography || userData.bio}`);
      }
    }

    console.log('\n✅ Datos obtenidos exitosamente');
    console.log('\n💡 Nota: Para obtener publicaciones específicas,');
    console.log('   consulta la documentación de tu API en RapidAPI');
    console.log(`   https://${CONFIG.RAPIDAPI_HOST}/docs\n`);

    return data;

  } catch (error) {
    console.error('❌ Error al obtener datos:\n');

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Mensaje: ${error.response.data?.message || error.response.statusText}`);

      if (error.response.status === 401) {
        console.error('\n💡 Error de autenticación:');
        console.error('   - Verifica que tu RAPIDAPI_KEY sea correcta');
        console.error('   - Asegúrate de estar suscrito a la API');
      } else if (error.response.status === 429) {
        console.error('\n💡 Límite de requests alcanzado:');
        console.error('   - Espera un momento antes de volver a intentar');
        console.error('   - Considera actualizar tu plan en RapidAPI');
      } else if (error.response.status === 404) {
        console.error('\n💡 Usuario no encontrado o endpoint incorrecto:');
        console.error(`   - Verifica que @${username} exista`);
        console.error('   - Verifica el RAPIDAPI_HOST en .env');
      }
    } else {
      console.error(error.message);
    }

    process.exit(1);
  }
}

/**
 * Ejemplo alternativo con otra API popular
 */
async function getInstagramPostsAlternative(username) {
  try {
    // Esta es otra API de RapidAPI (Instagram Data API)
    const url = 'https://instagram-data1.p.rapidapi.com/user/info';

    const options = {
      method: 'GET',
      url: url,
      params: { username: username },
      headers: {
        'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'instagram-data1.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);
    return response.data;

  } catch (error) {
    console.error('API alternativa no disponible o no suscrita');
    return null;
  }
}

/**
 * Muestra las APIs disponibles
 */
function showAvailableAPIs() {
  console.log('\n📋 APIs de Instagram disponibles en RapidAPI:\n');

  const apis = [
    {
      name: 'Instagram Scraper API2',
      url: 'https://rapidapi.com/restyler/api/instagram-scraper-api2',
      free_tier: '100 requests/mes',
      features: ['Perfil', 'Posts', 'Stories', 'Reels']
    },
    {
      name: 'Instagram Data API',
      url: 'https://rapidapi.com/viralinfotech/api/instagram-data1',
      free_tier: '50 requests/mes',
      features: ['Perfil', 'Posts', 'Followers']
    },
    {
      name: 'Instagram247',
      url: 'https://rapidapi.com/b11-infotech-b11-infotech-default/api/instagram247',
      free_tier: '500 requests/mes',
      features: ['Perfil', 'Posts', 'Hashtags']
    },
    {
      name: 'Instagram Bulk Profile Scrapper',
      url: 'https://rapidapi.com/joshlucpoll/api/instagram-bulk-profile-scrapper',
      free_tier: '100 requests/mes',
      features: ['Perfil masivo', 'Posts', 'Analytics']
    }
  ];

  apis.forEach((api, index) => {
    console.log(`${index + 1}. ${api.name}`);
    console.log(`   URL: ${api.url}`);
    console.log(`   Plan gratuito: ${api.free_tier}`);
    console.log(`   Características: ${api.features.join(', ')}`);
    console.log('');
  });

  console.log('💡 Recomendación: Prueba varias APIs para encontrar la que mejor se adapte a tus necesidades');
}

/**
 * Función principal
 */
async function main() {
  const username = process.argv[2];

  console.log('═══════════════════════════════════════════════════════');
  console.log('   📷 INSTAGRAM via RapidAPI');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!username) {
    console.log('❌ Falta nombre de usuario\n');
    console.log('Uso: node get-instagram-rapidapi.js <username>\n');
    console.log('Ejemplo:');
    console.log('  node get-instagram-rapidapi.js bcv.org.ve\n');

    showAvailableAPIs();
    process.exit(1);
  }

  const cleanUsername = username.replace('@', '');

  await getInstagramProfile(cleanUsername);
}

// Ejecutar
if (require.main === module) {
  main().catch(error => {
    console.error('Error fatal:', error.message);
    process.exit(1);
  });
}

module.exports = {
  getInstagramProfile,
  getInstagramPostsAlternative
};