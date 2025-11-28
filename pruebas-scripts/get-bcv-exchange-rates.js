/**
 * Script TODO-EN-UNO para obtener tasas del BCV desde Instagram
 *
 * 1. Descarga la última imagen del BCV de Instagram
 * 2. Extrae las tasas de cambio usando OCR (Python)
 * 3. Retorna los datos en formato JSON
 *
 * Uso:
 * node get-bcv-exchange-rates.js
 * node get-bcv-exchange-rates.js --json
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getLatestImage, downloadImage } = require('./get-latest-instagram-image');

/**
 * Obtiene las tasas del BCV completas
 */
async function getBCVRates() {
  const tempDir = path.join(__dirname, 'temp');
  const tempImagePath = path.join(tempDir, `bcv_${Date.now()}.jpg`);

  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('   💵 OBTENER TASAS DEL BCV');
    console.log('═══════════════════════════════════════════════════════\n');

    // Crear directorio temporal si no existe
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Paso 1: Obtener última imagen de Instagram
    console.log('🔄 Paso 1: Obteniendo última publicación del BCV...');
    const instagramData = await getLatestImage('bcv.org.ve');
    console.log('✅ Imagen obtenida de Instagram\n');

    // Paso 2: Descargar imagen
    console.log('🔄 Paso 2: Descargando imagen...');
    await downloadImage(instagramData.imageUrl, tempImagePath);
    console.log('✅ Imagen descargada\n');

    // Paso 3: Ejecutar OCR con Python
    console.log('🔄 Paso 3: Extrayendo tasas con OCR...');

    const pythonScript = path.join(__dirname, 'src', 'py-script', 'extract_exchange_rates.py');
    const command = `python3 "${pythonScript}" "${tempImagePath}" --json`;

    const result = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });

    const ocrData = JSON.parse(result);

    if (!ocrData.success) {
      throw new Error(ocrData.error || 'Error en OCR');
    }

    console.log(`✅ ${ocrData.count} tasas extraídas\n`);

    // Combinar datos
    const finalData = {
      success: true,
      source: 'Instagram BCV (@bcv.org.ve)',
      timestamp: new Date().toISOString(),
      instagram: {
        postUrl: instagramData.postUrl,
        imageUrl: instagramData.imageUrl,
        caption: instagramData.caption,
        date: instagramData.dateLocal,
        likes: instagramData.likes
      },
      rates: ocrData.rates,
      currencies: ocrData.currencies,
      count: ocrData.count
    };

    // Limpiar archivo temporal
    if (fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }

    return finalData;

  } catch (error) {
    // Limpiar archivo temporal en caso de error
    if (fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }

    throw error;
  }
}

/**
 * Formatea las tasas para mostrar en consola
 */
function formatRates(data) {
  const lines = [];

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('   💵 TASAS DE CAMBIO BCV');
  lines.push('═══════════════════════════════════════════════════════\n');

  lines.push(`📅 Fecha: ${data.instagram.date}`);
  lines.push(`🔗 Post: ${data.instagram.postUrl}`);
  lines.push(`❤️  Likes: ${data.instagram.likes.toLocaleString()}\n`);

  lines.push('💱 Tasas de cambio:\n');

  // Ordenar por código de moneda
  const sortedCurrencies = Object.keys(data.rates).sort();

  sortedCurrencies.forEach(currency => {
    const rate = data.rates[currency];
    lines.push(`   Bs/${currency}  ${rate.toFixed(8).padStart(15)}`);
  });

  lines.push('\n═══════════════════════════════════════════════════════');
  lines.push(`\n💡 Total: ${data.count} monedas`);
  lines.push(`⏰ Consultado: ${new Date(data.timestamp).toLocaleString('es-ES')}`);
  lines.push('═══════════════════════════════════════════════════════\n');

  return lines.join('\n');
}

/**
 * Función principal
 */
async function main() {
  const outputJson = process.argv.includes('--json');

  try {
    const data = await getBCVRates();

    if (outputJson) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(formatRates(data));
    }

    return data;

  } catch (error) {
    if (outputJson) {
      console.log(JSON.stringify({
        success: false,
        error: error.message
      }, null, 2));
    } else {
      console.error('\n❌ Error:', error.message);
      console.error('\n💡 Verifica:');
      console.error('   - Conexión a internet');
      console.error('   - API key de RapidAPI en .env.development');
      console.error('   - Python y dependencias instaladas\n');
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
  getBCVRates,
  formatRates
};