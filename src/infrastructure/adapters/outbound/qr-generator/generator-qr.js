const QRCode = require("qrcode");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

(async () => {
  try {
    console.log("🚀 Iniciando generación del QR...");
    const phoneNumber = "+51981025563";
    const message = "Hola, estoy interesado en cotizar tela acabada para confección";
    const messageEncoded = encodeURIComponent(message);
    const links = [
      {web: `https://wa.me/${phoneNumber}?text=${messageEncoded}`},
      {app: `whatsapp://send?phone=${phoneNumber}&text=${messageEncoded}`},
    ];
    // URL con mensaje
    const waLink =
      "intent://send?519981025563&text=Hola,%20estoy%20interesado%20en%20cotizar%20tela%20acabada%20para%20confección";
    
    console.log("✅ QR generado en memoria");
    // Ruta del logo de WhatsApp (debes tener un PNG transparente en tu carpeta)
    const logoPath = path.join(__dirname, "whatsapp.png");
    const logo = await sharp(logoPath).resize(100, 100).toBuffer();
    console.log("✅ Logo cargado en memoria");


    for (const [index, linkObj] of links.entries()) {
        const waLink = Object.values(linkObj)[0];

        console.log(`\n🔗 Generando QR para el enlace [${index}]:`, waLink);

        // Generar QR en formato buffer PNG
        const qrBuffer = await QRCode.toBuffer(waLink, {
            type: "png",
            errorCorrectionLevel: "H", // más robusto, permite logo en el centro
            width: 500,
            margin: 2,
            color: {
            dark: "#e1b734",
            light: null,
            },
        });
  
        // Combinar QR + logo en el centro
        const finalImage = await sharp(qrBuffer)
            .composite([
                {
                    input: logo,
                    gravity: "center", // coloca el logo en el centro
                },
            ])
            .png()
            .toBuffer();
    
        console.log(`🖼️ Imagen combinada (QR + logo) para el enlace [${index}] generada.`);
    
        // Construir el nombre del archivo final
        const fileName = `qr-link-${index}-${phoneNumber}.png`;

        // Guardar la imagen combinada como un archivo PNG
        fs.writeFileSync(fileName, finalImage);
        console.log(`✅ QR guardado: ${fileName}`);
    }
    console.log("\n✔️ Proceso completado. Todos los códigos QR han sido generados.");
  } catch (err) {
    console.error("❌ Error generando QR:", err);
  }
})();