function isValidDateFormat(dateString) {
    // Expresión regular para validar el formato DD/MM/AAAA
    const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/([0-9]{4})$/;
    return regex.test(dateString);
}

function isOfLegalAge(dateString) {
    // Validar el formato de fecha
    if (!isValidDateFormat(dateString)) {
        return false; // Formato inválido
    }

    // Extraer el día, mes y año
    const [day, month, year] = dateString.split('/').map(Number);

    // Crear una fecha a partir de los valores
    const birthDate = new Date(year, month - 1, day); // Los meses son 0-indexados en JavaScript
    const today = new Date();

    // Verificar si la fecha es válida
    if (birthDate.getFullYear() !== year || birthDate.getMonth() + 1 !== month || birthDate.getDate() !== day) {
        return false; // Fecha inválida
    }

    // Calcular la edad
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Ajustar la edad si el cumpleaños aún no ha ocurrido este año
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age >= 18; // Retorna true si es mayor de edad
}

module.exports = { isValidDateFormat, isOfLegalAge };