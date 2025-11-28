/**
 * Script de debug para verificar la conexión de Instagram
 */

const axios = require('axios');

const CONFIG = {
  PAGE_ID: '105896514913641',
  PAGE_ACCESS_TOKEN: 'EAAad7McNuAQBP9DZAlgrt2yunSAmmIlUYJmrVrR4SC64EdGTvDFYU3GVkrb4MMJ4fTYxNN8ElTNd7aycS7WGD8z4VpPu3xgFxrSXF5k7TOdf3tBofYgpRqgtZCJQLsZArr94uOySmauNkAfTt6a7tmbmdZBzZBUOlrCpyVr4EQtZAJnjAFLb2ZBZC9ChPww3BAdYw7qKjbnZCzn7dsOdD'
};

async function debugInstagram() {
  try {
    console.log('🔍 Verificando conexión de Instagram...\n');

    // 1. Verificar información de la página
    console.log('1️⃣ Consultando información de la página...');
    const pageUrl = `https://graph.facebook.com/v21.0/${CONFIG.PAGE_ID}`;
    const pageParams = {
      fields: 'id,name,instagram_business_account,connected_instagram_account',
      access_token: CONFIG.PAGE_ACCESS_TOKEN
    };

    const pageResponse = await axios.get(pageUrl, { params: pageParams });
    console.log('Respuesta de página:', JSON.stringify(pageResponse.data, null, 2));

    // 2. Verificar si hay instagram_business_account
    if (pageResponse.data.instagram_business_account) {
      console.log('\n✅ Instagram Business Account encontrado!');
      const igAccountId = pageResponse.data.instagram_business_account.id;

      // 3. Obtener información de Instagram
      console.log('\n2️⃣ Consultando información de Instagram...');
      const igUrl = `https://graph.facebook.com/v21.0/${igAccountId}`;
      const igParams = {
        fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url',
        access_token: CONFIG.PAGE_ACCESS_TOKEN
      };

      const igResponse = await axios.get(igUrl, { params: igParams });
      console.log('Respuesta de Instagram:', JSON.stringify(igResponse.data, null, 2));

      // 4. Intentar obtener última publicación
      console.log('\n3️⃣ Consultando última publicación...');
      const mediaUrl = `https://graph.facebook.com/v21.0/${igAccountId}/media`;
      const mediaParams = {
        fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
        limit: 1,
        access_token: CONFIG.PAGE_ACCESS_TOKEN
      };

      const mediaResponse = await axios.get(mediaUrl, { params: mediaParams });
      console.log('Respuesta de media:', JSON.stringify(mediaResponse.data, null, 2));

    } else if (pageResponse.data.connected_instagram_account) {
      console.log('\n⚠️  Se encontró connected_instagram_account (cuenta personal)');
      console.log('Necesitas una cuenta de Instagram Business, no personal.');
      console.log('Datos:', JSON.stringify(pageResponse.data.connected_instagram_account, null, 2));
    } else {
      console.log('\n❌ No se encontró ninguna cuenta de Instagram vinculada');
      console.log('Campos disponibles:', Object.keys(pageResponse.data));
    }

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Detalles del error:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugInstagram();