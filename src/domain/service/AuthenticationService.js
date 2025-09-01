const bcrypt = require('bcrypt');
const AuthenticationUseCase = require('../../application/ports/input/AuthenticationUseCase');
const { IllegalArgumentException, AuthenticationException } = require('../../domain/exceptions/index');

class AuthenticationService extends AuthenticationUseCase {
  constructor(userRepository, tokenGenerator) {
    super();
    this.userRepository = userRepository;
    this.tokenGenerator = tokenGenerator;
  }

  async authenticate(credentials) {
    // Validar entrada
    this._validateCredentials(credentials);

    const { email, password } = credentials;

    try {
      // Buscar usuario
      const user = await this.userRepository.findByUsername(email);
      
      if (!user) {
        throw new AuthenticationException('Credenciales inválidas');
      }

      // Verificar que sea empleado
      if (!user.isEmployee()) {
        throw new AuthenticationException('Acceso no autorizado al panel de ventas');
      }

      // Verificar que esté activo
      if (!user.isActive()) {
        throw new AuthenticationException('Usuario inactivo');
      }

      // Verificar contraseña
      const isValidPassword = user.hasValidCredentials(password, bcrypt);
      if (!isValidPassword) {
        throw new AuthenticationException('Credenciales inválidas');
      }

      // Generar token
      const token = await this.tokenGenerator.generateToken(user);

      // Actualizar último login
      await this.updateLastLogin(user.id);

      // Retornar datos de autenticación
      return {
        user: user.toJSON(),
        token,
        userType: user.user_type?.name,
        expiresIn: 3600, // 1 hour
        permissions: this._getUserPermissions(user.user_type?.name)
      };

    } catch (error) {
      if (error instanceof AuthenticationException) {
        throw error;
      }
      
      // Log del error del sistema pero retornar error genérico
      console.error('System error during authentication:', error);
      throw new AuthenticationException('Error interno del sistema');
    }
  }

  async updateLastLogin(userId) {
    try {
      const now = new Date();
      await this.userRepository.updateLastLogin(userId, now);
    } catch (error) {
      // No es crítico si falla, solo loggear
      console.warn('Failed to update last login for user:', userId, error.message);
    }
  }

  _validateCredentials(credentials) {
    if (!credentials) {
      throw new IllegalArgumentException('Las credenciales son requeridas');
    }

    const { email, password } = credentials;

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new IllegalArgumentException('El email es requerido y debe ser válido');
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      throw new IllegalArgumentException('La contraseña es requerida');
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new IllegalArgumentException('El formato del email no es válido');
    }

    // Validar longitud mínima de contraseña
    if (password.length < 3) {
      throw new IllegalArgumentException('La contraseña debe tener al menos 3 caracteres');
    }
  }

  _getUserPermissions(userType) {
    const permissions = {
      admin: [
        'view_users', 'create_users', 'edit_users', 'delete_users',
        'view_clients', 'create_clients', 'edit_clients',
        'view_departments', 'manage_departments',
        'view_reports', 'manage_system'
      ],
      supervisor: [
        'view_users', 'create_users', 'edit_users',
        'view_clients', 'create_clients', 'edit_clients',
        'view_departments', 'view_reports'
      ],
      agent: [
        'view_clients', 'create_clients', 'edit_clients',
        'view_reports'
      ]
    };

    return permissions[userType] || [];
  }
}

module.exports = AuthenticationService;