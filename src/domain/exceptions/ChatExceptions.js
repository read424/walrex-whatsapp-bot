/**
 * Excepciones de dominio para el módulo de Chat
 * Estas excepciones representan violaciones de reglas de negocio en el contexto de chat
 */

/**
 * Excepción lanzada cuando una sesión de chat no es encontrada
 */
class SessionNotFoundException extends Error {
    constructor(message = 'Chat session not found') {
        super(message);
        this.name = 'SessionNotFoundException';
        this.code = 'SESSION_NOT_FOUND';
        this.statusCode = 404;
    }
}

/**
 * Excepción lanzada cuando una sesión de chat está cerrada
 */
class SessionClosedException extends Error {
    constructor(message = 'Chat session is closed') {
        super(message);
        this.name = 'SessionClosedException';
        this.code = 'SESSION_CLOSED';
        this.statusCode = 400;
    }
}

/**
 * Excepción lanzada cuando una conexión de WhatsApp no está disponible
 */
class ConnectionUnavailableException extends Error {
    constructor(message = 'WhatsApp connection not available') {
        super(message);
        this.name = 'ConnectionUnavailableException';
        this.code = 'CONNECTION_UNAVAILABLE';
        this.statusCode = 503;
    }
}

/**
 * Excepción lanzada cuando un mensaje es inválido
 */
class InvalidMessageException extends Error {
    constructor(message = 'Invalid message') {
        super(message);
        this.name = 'InvalidMessageException';
        this.code = 'INVALID_MESSAGE';
        this.statusCode = 400;
    }
}

/**
 * Excepción lanzada cuando un contacto no es encontrado
 */
class ContactNotFoundException extends Error {
    constructor(message = 'Contact not found') {
        super(message);
        this.name = 'ContactNotFoundException';
        this.code = 'CONTACT_NOT_FOUND';
        this.statusCode = 404;
    }
}

/**
 * Excepción lanzada cuando un contacto ya existe
 */
class ContactAlreadyExistsException extends Error {
    constructor(message = 'Contact already exists') {
        super(message);
        this.name = 'ContactAlreadyExistsException';
        this.code = 'CONTACT_ALREADY_EXISTS';
        this.statusCode = 409;
    }
}

/**
 * Excepción lanzada cuando los datos de actualización son inválidos
 */
class InvalidUpdateDataException extends Error {
    constructor(message = 'Invalid update data') {
        super(message);
        this.name = 'InvalidUpdateDataException';
        this.code = 'INVALID_UPDATE_DATA';
        this.statusCode = 400;
    }
}

module.exports = {
    SessionNotFoundException,
    SessionClosedException,
    ConnectionUnavailableException,
    InvalidMessageException,
    ContactNotFoundException,
    ContactAlreadyExistsException,
    InvalidUpdateDataException
};