class IllegalArgumentException extends Error {
    constructor(message = 'Invalid argument provided') {
      super(message);
      this.name = 'IllegalArgumentException';
      this.statusCode = 400;
    }
  }
  
module.exports = IllegalArgumentException;