/**
 * Script alternativo para obtener publicaciones de Instagram
 * Usa una aproximación diferente con los permisos disponibles
 */

require('dotenv').config({ path: '.env.development' });
const axios = require('axios');

const CONFIG = {
  INSTAGRAM_ACCOUNT_ID: process.env.INSTAGRAM_ACCOUNT_ID,
  ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
  PAGE_ID: process.env.FACEBOOK_PAGE_ID,
  GRAPH_API_VERSION: 'v21.0'
};

async function testPermissions() {
  console.log('🔍 Verificando permisos disponibles...\n');

  try {
    // Método 1: Intentar obtener información básica
    console.log('Método 1: Información de cuenta...');
    const accountUrl = `https://graph.facebook.com/${CONFIG.GRAPH_API_VERSION}/${CONFIG.INSTAGRAM_ACCOUNT_ID}`;
    const accountResponse = await axios.get(accountUrl, {
      params: {
        fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url',
        access_token: CONFIG.ACCESS_TOKEN
      }
    });
    console.log('✅ Información de cuenta obtenida:');
    console.log(JSON.stringify(accountResponse.data, null, 2));
    console.log('');

    // Método 2: Intentar obtener media con diferentes campos
    console.log('Método 2: Intentando obtener media con campos básicos...');
    const mediaUrl = `https://graph.facebook.com/${CONFIG.GRAPH_API_VERSION}/${CONFIG.INSTAGRAM_ACCOUNT_ID}/media`;

    try {
      const mediaResponse = await axios.get(mediaUrl, {
        params: {
          fields: 'id,timestamp,media_type,permalink',
          limit: 1,
          access_token: CONFIG.ACCESS_TOKEN
        }
      });
      console.log('✅ Publicaciones obtenidas:');
      console.log(JSON.stringify(mediaResponse.data, null, 2));
      return mediaResponse.data;
    } catch (mediaError) {
      console.log('❌ No se pudo obtener media directamente');
      if (mediaError.response?.data) {
        console.log('Error:', mediaError.response.data.error.message);
      }
    }

    // Método 3: Obtener a través de la página de Facebook
    console.log('\nMétodo 3: Intentando a través de la página de Facebook...');
    const pageUrl = `https://graph.facebook.com/${CONFIG.GRAPH_API_VERSION}/${CONFIG.PAGE_ID}`;
    const pageResponse = await axios.get(pageUrl, {
      params: {
        fields: 'instagram_business_account{id,username,media{id,timestamp,media_type,permalink}}',
        access_token: CONFIG.ACCESS_TOKEN
      }
    });

    if (pageResponse.data.instagram_business_account?.media) {
      console.log('✅ Publicaciones obtenidas a través de la página:');
      console.log(JSON.stringify(pageResponse.data.instagram_business_account.media, null, 2));
      return pageResponse.data.instagram_business_account.media;
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function checkAppPermissions() {
  console.log('\n🔐 Verificando permisos de la app...\n');

  try {
    const url = `https://graph.facebook.com/${CONFIG.GRAPH_API_VERSION}/me/permissions`;
    const response = await axios.get(url, {
      params: {
        access_token: CONFIG.ACCESS_TOKEN
      }
    });

    console.log('Permisos otorgados:');
    response.data.data.forEach(perm => {
      const status = perm.status === 'granted' ? '✅' : '❌';
      console.log(`${status} ${perm.permission}: ${perm.status}`);
    });

    return response.data.data;
  } catch (error) {
    console.error('Error al verificar permisos:', error.response?.data || error.message);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   📷 INSTAGRAM - Diagnóstico de Permisos');
  console.log('═══════════════════════════════════════════════════════\n');

  // Verificar permisos
  await checkAppPermissions();

  console.log('\n═══════════════════════════════════════════════════════\n');

  // Probar diferentes métodos
  await testPermissions();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('\n💡 SOLUCIONES POSIBLES:\n');
  console.log('1. Solicitar revisión de la app en Meta for Developers');
  console.log('   - Ve a: App Dashboard → Revisión de aplicaciones');
  console.log('   - Solicita los permisos: instagram_basic, instagram_content_publish');
  console.log('');
  console.log('2. Usar la API de Instagram Basic Display (solo lectura)');
  console.log('   - Mejor para obtener contenido sin enviar mensajes');
  console.log('   - No requiere cuenta Business (puede ser cuenta personal)');
  console.log('');
  console.log('3. Web Scraping (NO RECOMENDADO)');
  console.log('   - Viola términos de servicio de Instagram');
  console.log('   - Puede bloquear tu cuenta');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);