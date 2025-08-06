const { normalizePhoneNumber, getCountryCode } = require('./phoneUtil');
const UUIDUtil  = require('./uuidUtil');
const { isValidDateFormat, isOfLegalAge } = require('./utils-date');
const { isValidEmail } = require('./emailValidate');
const { cleanSetterLastName, generatePassword, verifyPassword, interpolate, unicodeToEmoji } = require('./util-string');
const { validatePoll } = require('./validationMessage');

module.exports = {
    normalizePhoneNumber,
    UUIDUtil,
    isValidDateFormat,
    isOfLegalAge,
    isValidEmail,
    cleanSetterLastName,
    getCountryCode,
    generatePassword,
    verifyPassword,
    validatePoll,
    interpolate,
    unicodeToEmoji
};