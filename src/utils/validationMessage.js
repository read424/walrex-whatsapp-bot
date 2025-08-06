function validatePoll(poll) {
    // Validar que "name" exista y sea una cadena no vacía
    if (!poll.name || typeof poll.name !== 'string' || poll.name.trim() === '') {
        return { valid: false, message: 'El campo "name" es obligatorio y debe ser una cadena no vacía.' };
    }

    // Validar que "options" exista, sea un arreglo y que no esté vacío
    if (!poll.options || !Array.isArray(poll.options) || poll.options.length === 0) {
        return { valid: false, message: 'El campo "options" debe ser un arreglo no vacío.' };
    }

    // Validar que cada opción en "options" tenga un "name" que sea una cadena no vacía
    for (const option of poll.options) {
        if (!option.name || typeof option.name !== 'string' || option.name.trim() === '') {
            return { valid: false, message: 'Cada opción debe tener un campo "name" no vacío.' };
        }
    }

    // Validar que "selectableOptionsCount" exista, sea un número y no sea mayor al total de opciones
    if (typeof poll.selectableOptionsCount !== 'number' || poll.selectableOptionsCount < 1 || poll.selectableOptionsCount > poll.options.length) {
        return { valid: false, message: 'El campo "selectableOptionsCount" debe ser un número mayor a 0 y no mayor al número de opciones.' };
    }

    // Si todas las validaciones pasan
    return { valid: true, message: 'El objeto "poll" es válido.' };
}

module.exports = { validatePoll };