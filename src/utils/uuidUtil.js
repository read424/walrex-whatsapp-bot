const { v4: uuidv4 } = require('uuid');

class UUIDUtil {
    // Genera un código de referencia único usando UUID
    static generateReferralCode() {
        return uuidv4().split('-')[0].toUpperCase();  // Usa solo una parte del UUID
    }
}

module.exports = UUIDUtil;