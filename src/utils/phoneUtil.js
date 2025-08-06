const structuredLogger = require('../infrastructure/config/StructuredLogger');

function normalizePhoneNumber(phoneNumber) {
    const suffix = '@c.us';
    // Verificar si el número ya contiene el sufijo
    if (phoneNumber.endsWith(suffix)) {
        // Eliminar el sufijo
        return phoneNumber.slice(0, -suffix.length); // Retornar sin el sufijo
    } else {
        // Agregar el sufijo
        return phoneNumber + suffix;// Retornar con el sufijo
    }
}

function isPhoneNANP(phoneNumber){
    phoneNumber = phoneNumber.replace(/\s+/g, '');
    return phoneNumber.startsWith('1');
}

function getCountryCode(phoneNumber) {
    // Elimina espacios en blanco
    phoneNumber = phoneNumber.replace(/\s+/g, '');
        
    // Regex para capturar el código de país (1 a 3 dígitos antes del resto del número)
    const regex = /^(\d{1,3})\d+@c\.us$/; 
    const match = phoneNumber.match(regex);
    if (match) {
        return match[1]; // Retorna el código del país
    } else {
        return null; // Retorna null si el formato no es válido
    }
}

module.exports = { normalizePhoneNumber, getCountryCode };