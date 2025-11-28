/**
 * Script para obtener todos los tokens e IDs necesarios de Meta/Facebook/Instagram
 *
 * Uso:
 * 1. Coloca tu APP_ID, APP_SECRET y USER_ACCESS_TOKEN (temporal del explorador de API)
 * 2. Ejecuta: node get-meta-tokens.js
 * 3. Copia los valores generados a tu archivo .env
 */

const axios = require('axios');

// ===== CONFIGURACIÓN =====
const CONFIG = {
  APP_ID: '1862490137671684',           // Desde Configuración > Básica
  APP_SECRET: '1be49a50167eeed02bd801255b44062d',   // Desde Configuración > Básica
  USER_ACCESS_TOKEN: 'EAAad7McNuAQBP2cIXSMPpZCALqx1HDZC6VDvJvPZB0vSw3q2pZBBAZB2MQkXoZAMZAUllVggxHhj6yWUWqYBX6IIt9xy0QAFfQcYVrlLZBoS1UOwAq38ETxm6uc6GZCTakHlHyRjOTEG6HXHjLYkAZAetx9SvMasjU4JOkxkDa6tDhrP3u2aYGDpQfbSuSJBgTy9i622UsoMWtAhLP1dvndcGMYZBjYTePf7aPLcUh7GnmWrIdRg19MfoimSxOrueEd9nsxZBf9heh258McatRAUJPPEcWiSswZDZD' // Del explorador de API de Graph
};

const GRAPH_API_VERSION = 'v24.0'; // Puedes usar v21.0 o v22.0

// ===== FUNCIONES =====

/**
 * Obtiene un token de acceso de larga duración (60 días)
 */
async function getLongLivedUserToken() {
  try {
    console.log('\n🔄 Paso 1: Convirtiendo User Access Token a larga duración...');

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`;
    const params = {
      grant_type: 'fb_exchange_token',
      client_id: CONFIG.APP_ID,
      client_secret: CONFIG.APP_SECRET,
      fb_exchange_token: CONFIG.USER_ACCESS_TOKEN
    };

    const response = await axios.get(url, { params });
    console.log('✅ Token de larga duración obtenido');

    return response.data.access_token;
  } catch (error) {
    console.error('❌ Error obteniendo token de larga duración:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Obtiene las páginas de Facebook asociadas a la cuenta
 */
async function getPages(userToken) {
  try {
    console.log('\n🔄 Paso 2: Obteniendo páginas de Facebook...');

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts`;
    const params = {
      access_token: userToken
    };

    const response = await axios.get(url, { params });

    if (!response.data.data || response.data.data.length === 0) {
      console.log('⚠️  No se encontraron páginas. Asegúrate de tener una página de Facebook.');
      return [];
    }

    console.log(`✅ Encontradas ${response.data.data.length} página(s)`);

    return response.data.data;
  } catch (error) {
    console.error('❌ Error obteniendo páginas:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Obtiene el Instagram Business Account ID asociado a una página
 */
async function getInstagramAccount(pageId, pageAccessToken) {
  try {
    console.log('\n🔄 Paso 3: Obteniendo cuenta de Instagram Business...');

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}`;
    const params = {
      fields: 'instagram_business_account',
      access_token: pageAccessToken
    };

    const response = await axios.get(url, { params });

    if (!response.data.instagram_business_account) {
      console.log('⚠️  No se encontró cuenta de Instagram vinculada a esta página.');
      return null;
    }

    console.log('✅ Cuenta de Instagram encontrada');

    return response.data.instagram_business_account.id;
  } catch (error) {
    console.error('❌ Error obteniendo cuenta de Instagram:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Obtiene información de la cuenta de Instagram
 */
async function getInstagramInfo(instagramAccountId, pageAccessToken) {
  try {
    console.log('\n🔄 Paso 4: Obteniendo información de Instagram...');

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramAccountId}`;
    const params = {
      fields: 'id,username,name,profile_picture_url',
      access_token: pageAccessToken
    };

    const response = await axios.get(url, { params });
    console.log('✅ Información de Instagram obtenida');

    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo información de Instagram:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Prueba obtener la última publicación de Instagram
 */
async function getLatestInstagramPost(instagramAccountId, pageAccessToken) {
  try {
    console.log('\n🔄 Paso 5: Probando obtener última publicación de Instagram...');

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instagramAccountId}/media`;
    const params = {
      fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
      limit: 1,
      access_token: pageAccessToken
    };

    const response = await axios.get(url, { params });

    if (!response.data.data || response.data.data.length === 0) {
      console.log('⚠️  No se encontraron publicaciones.');
      return null;
    }

    console.log('✅ Última publicación obtenida exitosamente');

    return response.data.data[0];
  } catch (error) {
    console.error('❌ Error obteniendo publicación:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando proceso de obtención de tokens e IDs...\n');
    console.log('========================================');

    // Validar configuración
    if (CONFIG.APP_ID === 'TU_APP_ID_AQUI' ||
        CONFIG.APP_SECRET === 'TU_APP_SECRET_AQUI' ||
        CONFIG.USER_ACCESS_TOKEN === 'TU_TOKEN_TEMPORAL_AQUI') {
      console.error('❌ Por favor, configura APP_ID, APP_SECRET y USER_ACCESS_TOKEN en el script');
      return;
    }

    // 1. Obtener token de larga duración
    const longLivedToken = await getLongLivedUserToken();

    // 2. Obtener páginas
    const pages = await getPages(longLivedToken);

    if (pages.length === 0) {
      console.log('\n⚠️  No se encontraron páginas. Crea una página de Facebook primero.');
      return;
    }

    // Mostrar páginas disponibles
    console.log('\n📄 Páginas disponibles:');
    pages.forEach((page, index) => {
      console.log(`   ${index + 1}. ${page.name} (ID: ${page.id})`);
    });

    // Usar la primera página (o puedes modificar esto para elegir)
    const selectedPage = pages[0];
    console.log(`\n✅ Usando página: ${selectedPage.name}`);

    // 3. Obtener Instagram Account
    const instagramAccountId = await getInstagramAccount(selectedPage.id, selectedPage.access_token);

    let instagramInfo = null;
    let latestPost = null;

    if (instagramAccountId) {
      // 4. Obtener información de Instagram
      instagramInfo = await getInstagramInfo(instagramAccountId, selectedPage.access_token);

      // 5. Probar obtener última publicación
      latestPost = await getLatestInstagramPost(instagramAccountId, selectedPage.access_token);
    }

    // ===== MOSTRAR RESULTADOS =====
    console.log('\n========================================');
    console.log('✅ PROCESO COMPLETADO');
    console.log('========================================\n');

    console.log('📋 COPIA ESTOS VALORES A TU ARCHIVO .env:\n');
    console.log('# Meta/Facebook Configuration');
    console.log(`META_APP_ID=${CONFIG.APP_ID}`);
    console.log(`META_APP_SECRET=${CONFIG.APP_SECRET}`);
    console.log(`META_VERIFY_TOKEN=tu_token_aleatorio_para_webhook`);
    console.log('');
    console.log('# Facebook Page');
    console.log(`FACEBOOK_PAGE_ID=${selectedPage.id}`);
    console.log(`FACEBOOK_PAGE_ACCESS_TOKEN=${selectedPage.access_token}`);
    console.log(`FACEBOOK_PAGE_NAME=${selectedPage.name}`);
    console.log('');

    if (instagramAccountId) {
      console.log('# Instagram Business Account');
      console.log(`INSTAGRAM_ACCOUNT_ID=${instagramAccountId}`);
      console.log(`INSTAGRAM_ACCESS_TOKEN=${selectedPage.access_token}`);
      if (instagramInfo) {
        console.log(`INSTAGRAM_USERNAME=${instagramInfo.username}`);
      }
    } else {
      console.log('# Instagram Business Account');
      console.log('# ⚠️  No se encontró cuenta de Instagram vinculada.');
      console.log('# Vincula tu cuenta de Instagram a la página de Facebook:');
      console.log('# 1. Ve a tu página de Facebook');
      console.log('# 2. Configuración > Instagram');
      console.log('# 3. Conectar cuenta');
    }

    console.log('\n========================================\n');

    // Mostrar información adicional
    if (instagramInfo) {
      console.log('📸 Información de Instagram:');
      console.log(`   Username: @${instagramInfo.username}`);
      console.log(`   Name: ${instagramInfo.name}`);
      console.log(`   ID: ${instagramInfo.id}`);
    }

    if (latestPost) {
      console.log('\n📝 Última publicación encontrada:');
      console.log(`   Tipo: ${latestPost.media_type}`);
      console.log(`   Fecha: ${latestPost.timestamp}`);
      console.log(`   Likes: ${latestPost.like_count || 'N/A'}`);
      console.log(`   Comentarios: ${latestPost.comments_count || 'N/A'}`);
      console.log(`   Caption: ${latestPost.caption ? latestPost.caption.substring(0, 100) + '...' : 'Sin caption'}`);
      console.log(`   URL: ${latestPost.permalink}`);
    }

    console.log('\n========================================');
    console.log('💡 NOTAS IMPORTANTES:');
    console.log('========================================');
    console.log('1. El Page Access Token tiene duración indefinida (no expira)');
    console.log('2. Guarda estos tokens de forma segura en tu .env');
    console.log('3. Nunca compartas estos tokens públicamente');
    console.log('4. Si necesitas múltiples páginas, modifica el script');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Error en el proceso:', error.message);
    process.exit(1);
  }
}

// Ejecutar
main();