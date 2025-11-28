/**
 * Explorador de endpoints para Instagram Scraper Stable API
 */

require('dotenv').config({ path: '.env.development' });
const axios = require('axios');

const CONFIG = {
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
  RAPIDAPI_HOST: process.env.RAPIDAPI_HOST
};

async function exploreEndpoints() {
  console.log('🔍 Explorando endpoints disponibles en la API...\n');

  // Posibles endpoints basados en el mensaje de error y estructura común
  const endpoints = [
    // Para obtener datos de un post
    { name: 'Media Data V2', path: '/get_media_data_v2.php', params: { post_url: 'https://www.instagram.com/p/DLUWkieNc0u/' } },
    { name: 'Media Info', path: '/get_media_info.php', params: { post_url: 'https://www.instagram.com/p/DLUWkieNc0u/' } },
    { name: 'Post Data', path: '/get_post_data.php', params: { post_url: 'https://www.instagram.com/p/DLUWkieNc0u/' } },

    // Para obtener perfil de usuario
    { name: 'User Profile', path: '/get_user_profile.php', params: { username: 'bcv.org.ve' } },
    { name: 'User Info', path: '/get_user_info.php', params: { username: 'bcv.org.ve' } },
    { name: 'User Data', path: '/get_user_data.php', params: { username: 'bcv.org.ve' } },

    // Para obtener posts de un usuario
    { name: 'User Posts', path: '/get_user_posts.php', params: { username: 'bcv.org.ve' } },
    { name: 'User Media', path: '/get_user_media.php', params: { username: 'bcv.org.ve' } },
    { name: 'User Feed', path: '/get_user_feed.php', params: { username: 'bcv.org.ve' } },
  ];

  const workingEndpoints = [];

  for (const endpoint of endpoints) {
    try {
      console.log(`📍 Probando: ${endpoint.name}`);
      console.log(`   URL: https://${CONFIG.RAPIDAPI_HOST}${endpoint.path}`);
      console.log(`   Params: ${JSON.stringify(endpoint.params)}`);

      const response = await axios.get(`https://${CONFIG.RAPIDAPI_HOST}${endpoint.path}`, {
        params: endpoint.params,
        headers: {
          'x-rapidapi-host': CONFIG.RAPIDAPI_HOST,
          'x-rapidapi-key': CONFIG.RAPIDAPI_KEY
        },
        timeout: 10000
      });

      console.log(`   ✅ FUNCIONA!`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
      console.log('');

      workingEndpoints.push({
        ...endpoint,
        response: response.data
      });

    } catch (error) {
      if (error.response) {
        const errorMsg = error.response.data?.error || error.response.data?.message || JSON.stringify(error.response.data);
        console.log(`   ❌ Error ${error.response.status}: ${errorMsg.substring(0, 100)}`);
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        console.log(`   ⏱️  Timeout - el endpoint tardó mucho`);
      } else {
        console.log(`   ❌ ${error.message}`);
      }
      console.log('');
    }

    // Pequeña pausa para no saturar la API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`✅ Endpoints funcionales encontrados: ${workingEndpoints.length}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (workingEndpoints.length > 0) {
    workingEndpoints.forEach((ep, index) => {
      console.log(`${index + 1}. ${ep.name}`);
      console.log(`   Path: ${ep.path}`);
      console.log(`   Params: ${JSON.stringify(ep.params)}`);
      console.log(`   Response preview:`);
      console.log(`   ${JSON.stringify(ep.response, null, 2).substring(0, 300)}...`);
      console.log('');
    });
  } else {
    console.log('❌ No se encontraron endpoints funcionales.');
    console.log('');
    console.log('💡 Opciones:');
    console.log('   1. Revisa la documentación de la API en RapidAPI');
    console.log('   2. Verifica que estés suscrito correctamente');
    console.log('   3. Considera cambiar a otra API de Instagram más documentada');
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🔬 EXPLORADOR DE API - Instagram Scraper Stable');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!CONFIG.RAPIDAPI_KEY) {
    console.error('❌ RAPIDAPI_KEY no configurado en .env.development');
    process.exit(1);
  }

  await exploreEndpoints();
}

main().catch(console.error);