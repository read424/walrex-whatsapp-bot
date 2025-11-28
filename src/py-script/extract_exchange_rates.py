#!/usr/bin/env python3
"""
Script para extraer tasas de cambio del BCV desde imagen usando OCR

Extrae líneas con formato:
Bs/EUR  258,34261419
Bs/CNY   31,23812072
Bs/TRY    5,28614519
etc.

Instalación:
pip install pytesseract pillow opencv-python

Uso:
python3 extract_exchange_rates.py imagen.jpg
python3 extract_exchange_rates.py imagen.jpg --json
"""

import sys
import re
import json
from pathlib import Path

try:
    import pytesseract
    from PIL import Image
    import cv2
    import numpy as np
except ImportError as e:
    print(f"❌ Error: Falta instalar dependencias")
    print(f"   {e}")
    print("\n📦 Instala con:")
    print("   pip install pytesseract pillow opencv-python")
    print("\n⚠️  También necesitas Tesseract OCR instalado:")
    print("   Ubuntu/Debian: sudo apt-get install tesseract-ocr tesseract-ocr-spa")
    print("   Mac: brew install tesseract")
    sys.exit(1)


def preprocess_image(image_path):
    """
    Preprocesa la imagen para mejorar el OCR
    """
    # Leer imagen
    img = cv2.imread(str(image_path))

    if img is None:
        raise ValueError(f"No se pudo leer la imagen: {image_path}")

    # Convertir a escala de grises
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Aplicar threshold para mejorar contraste
    # Esto ayuda a que el texto sea más legible
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)

    # Denoise (reducir ruido)
    denoised = cv2.fastNlMeansDenoising(thresh, None, 10, 7, 21)

    # Aumentar contraste
    contrast = cv2.convertScaleAbs(denoised, alpha=1.5, beta=0)

    return contrast


def extract_text_from_image(image_path, lang='spa'):
    """
    Extrae texto de la imagen usando Tesseract OCR
    """
    try:
        # Preprocesar imagen
        processed_img = preprocess_image(image_path)

        # Convertir a PIL Image para pytesseract
        pil_img = Image.fromarray(processed_img)

        # Configuración de Tesseract para mejorar precisión con números
        custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/,. '

        # Extraer texto
        text = pytesseract.image_to_string(
            pil_img,
            lang=lang,
            config=custom_config
        )

        return text

    except Exception as e:
        raise Exception(f"Error en OCR: {str(e)}")


def parse_exchange_rates(text):
    """
    Parsea el texto extraído para encontrar tasas de cambio

    Busca patrones como:
    Bs/EUR  258,34261419
    Bs/USD  221,74380000

    Solo extrae EUR y USD
    """
    rates = {}

    # Solo buscar EUR y USD
    target_currencies = ['EUR', 'USD']

    # Patrón regex mejorado para capturar:
    # Bs/XXX seguido de espacios y números con comas
    # También acepta variaciones como BS/, bs/, etc.
    pattern = r'(?:Bs|BS|bs)[/\s]*([A-Z]{3})\s+([\d,\.]+)'

    matches = re.finditer(pattern, text, re.IGNORECASE)

    for match in matches:
        currency = match.group(1).upper()

        # Solo procesar EUR y USD
        if currency not in target_currencies:
            continue

        rate_str = match.group(2)

        # Limpiar el rate: remover espacios y convertir comas a puntos
        rate_str = rate_str.strip().replace(',', '.')

        try:
            rate = float(rate_str)
            rates[currency] = rate
        except ValueError:
            # Si no se puede convertir, intentar limpiar más
            cleaned = re.sub(r'[^\d\.]', '', rate_str)
            try:
                rate = float(cleaned)
                rates[currency] = rate
            except ValueError:
                continue

    return rates


def format_output(rates, date_info=None):
    """
    Formatea las tasas para mostrar en consola
    """
    if not rates:
        return "⚠️  No se encontraron tasas de cambio"

    output = []
    output.append("═══════════════════════════════════════════════════════")
    output.append("   💵 TASAS DE CAMBIO BCV")
    output.append("═══════════════════════════════════════════════════════\n")

    if date_info:
        output.append(f"📅 Fecha: {date_info}\n")

    # Ordenar por código de moneda
    for currency in sorted(rates.keys()):
        rate = rates[currency]
        output.append(f"Bs/{currency:3s}  {rate:>15.8f}")

    output.append("\n═══════════════════════════════════════════════════════")

    return "\n".join(output)


def extract_date_from_text(text):
    """
    Intenta extraer la fecha del texto
    """
    # Patrones comunes de fecha
    patterns = [
        r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',  # 29-10-2025 o 29/10/2025
        r'(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})',  # 29 de octubre de 2025
        r'(\w+\s+\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',  # Miércoles 29-10-2025
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)

    return None


def main():
    """
    Función principal
    """
    if len(sys.argv) < 2:
        print("❌ Falta la ruta de la imagen\n")
        print("Uso: python3 extract_exchange_rates.py <imagen.jpg> [--json]\n")
        print("Ejemplos:")
        print("  python3 extract_exchange_rates.py bcv_image.jpg")
        print("  python3 extract_exchange_rates.py bcv_image.jpg --json")
        sys.exit(1)

    image_path = Path(sys.argv[1])
    output_json = '--json' in sys.argv

    if not image_path.exists():
        if not output_json:
            print(f"❌ Error: La imagen no existe: {image_path}")
        sys.exit(1)

    try:
        if not output_json:
            print(f"🔍 Procesando imagen: {image_path.name}\n")

        # Extraer texto
        if not output_json:
            print("📄 Extrayendo texto con OCR...")
        text = extract_text_from_image(image_path)

        if not output_json:
            print("✅ Texto extraído\n")

        # Extraer fecha si está disponible
        date_info = extract_date_from_text(text)

        # Parsear tasas de cambio
        if not output_json:
            print("💱 Buscando tasas de cambio...")
        rates = parse_exchange_rates(text)

        if not rates:
            if not output_json:
                print("\n⚠️  No se encontraron tasas de cambio en la imagen")
                print("\n📝 Texto extraído (para debugging):")
                print("─────────────────────────────────────────────────────")
                print(text)
                print("─────────────────────────────────────────────────────")
            sys.exit(1)

        if not output_json:
            print(f"✅ {len(rates)} tasas encontradas\n")

        # Salida
        if output_json:
            result = {
                'success': True,
                'date': date_info,
                'rates': rates,
                'currencies': list(rates.keys()),
                'count': len(rates)
            }
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(format_output(rates, date_info))
            print(f"\n💡 Total de monedas: {len(rates)}")

        return rates

    except Exception as e:
        if output_json:
            error_result = {
                'success': False,
                'error': str(e)
            }
            print(json.dumps(error_result, indent=2))
        else:
            print(f"\n❌ Error: {str(e)}")

        sys.exit(1)


if __name__ == '__main__':
    main()