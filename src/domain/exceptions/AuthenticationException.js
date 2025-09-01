class AuthenticationException extends Error {
    constructor(message = 'Authentication failed') {
      super(message);
      this.name = 'AuthenticationException';
      this.statusCode = 400;
    }
}

module.exports = AuthenticationException ;