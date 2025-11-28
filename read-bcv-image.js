/**
 * Script simple para leer tasas del BCV desde una imagen local usando OCR
 *
 * NO hace llamadas a RapidAPI, solo procesa imágenes ya descargadas
 *
 * Uso:
 * node read-bcv-image.js imagen.jpg
 * node read-bcv-image.js imagen.jpg --json
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Extrae tasas de cambio de una imagen usando OCR
 */
function extractRatesFromImage(imagePath, outputJson = false) {
  try {
    // Verificar que la imagen existe
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Imagen no encontrada: ${imagePath}`);
    }

    // Ejecutar script Python de OCR
    const pythonScript = path.join(__dirname, 'src', 'py-script', 'extract_exchange_rates.py');
    const command = `python3 "${pythonScript}" "${imagePath}" --json`;

    const result = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });

    const data = JSON.parse(result);

    if (!data.success) {
      throw new Error(data.error || 'Error al extraer tasas');
    }

    return data;

  } catch (error) {
    throw new Error(`Error procesando imagen: ${error.message}`);
  }
}

/**
 * Formatea las tasas para mostrar en consola
 */
function formatOutput(data) {
  const lines = [];

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('   💵 TASAS DE CAMBIO BCV (desde imagen local)');
  lines.push('═══════════════════════════════════════════════════════\n');

  if (data.date) {
    lines.push(`📅 Fecha (extraída): ${data.date}\n`);
  }

  lines.push('💱 Tasas encontradas:\n');

  // Ordenar por código de moneda
  const sortedCurrencies = Object.keys(data.rates).sort();

  sortedCurrencies.forEach(currency => {
    const rate = data.rates[currency];
    lines.push(`   Bs/${currency}  ${rate.toFixed(8).padStart(15)}`);
  });

  lines.push('\n═══════════════════════════════════════════════════════');
  lines.push(`\n💡 Total: ${data.count} monedas extraídas`);
  lines.push('═══════════════════════════════════════════════════════\n');

  return lines.join('\n');
}

/**
 * Función principal
 */
function main() {
  const imagePath = process.argv[2];
  const outputJson = process.argv.includes('--json');

  if (!imagePath) {
    console.log('❌ Falta la ruta de la imagen\n');
    console.log('Uso: node read-bcv-image.js <imagen.jpg> [--json]\n');
    console.log('Ejemplos:');
    console.log('  node read-bcv-image.js instagram_bcv.org.ve_1761845929332.jpg');
    console.log('  node read-bcv-image.js bcv_image.jpg --json\n');
    process.exit(1);
  }

  try {
    if (!outputJson) {
      console.log('🔍 Procesando imagen con OCR...\n');
    }

    const data = extractRatesFromImage(imagePath, outputJson);

    if (outputJson) {
      // Formato JSON limpio
      const result = {
        success: true,
        source: 'Imagen local',
        imagePath: imagePath,
        timestamp: new Date().toISOString(),
        rates: data.rates,
        currencies: data.currencies,
        count: data.count,
        date: data.date || null
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatOutput(data));
    }

  } catch (error) {
    if (outputJson) {
      console.log(JSON.stringify({
        success: false,
        error: error.message
      }, null, 2));
    } else {
      console.error(`\n❌ Error: ${error.message}\n`);
      console.error('💡 Verifica:');
      console.error('   - La imagen existe y es legible');
      console.error('   - Python y dependencias están instaladas');
      console.error('   - Tesseract OCR está instalado\n');
    }
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  main();
}

// Exportar
module.exports = { extractRatesFromImage };
