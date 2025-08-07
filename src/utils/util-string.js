const structuredLogger = require('../infrastructure/config/StructuredLogger');
const bcrypt = require('bcrypt');

function cleanSetterLastName(lastname){
    const palabras = lastname.trim().split(/\s+/);

    let primer_apellido = null;
    let segundo_apellido = null;
    if(palabras.length === 1){
        primer_apellido = palabras[0]; 
    }else if(palabras.length === 2){
        primer_apellido = palabras[0];
        segundo_apellido = palabras[1];
    }else if(palabras.length>2){
        primer_apellido = palabras.slice(0, 2).join(' ');
        segundo_apellido = palabras.slice(2).join(' ');
    }
    return { primer_apellido, segundo_apellido };
}

async function generatePassword(password) {
    try {
        const saltRounds = 10; // Número de rondas de sal (puede ajustarse según el nivel de seguridad)
        
        // Genera el hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        return hashedPassword;
    } catch (error) {
        console.error('Error al generar el hash:', error);
        throw error;
    }
}

async function verifyPassword(plainPassword, hashedPassword) {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
}

async function interpolate(template, vars) {
    const matches = [...template.matchAll(/{\$\$(\w+)}/g)];
    for(const match of matches){
        const [placeholder, key] = match;
        const value = vars[key];
        template = template.replace(placeholder, value || placeholder);
    }
    return template;
}

function unicodeToEmoji(unicodeArray) {
    // Convierte cada código `U+XXXX` a un carácter
    return unicodeArray
        .map(code => String.fromCodePoint(parseInt(code.replace('U+', ''), 16)))
        .join(''); // Une los caracteres para formar el emoji
}

module.exports = {
    cleanSetterLastName,
    generatePassword,
    verifyPassword,
    interpolate,
    unicodeToEmoji
}