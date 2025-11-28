const UserRepositoryPort = require('../../../../application/ports/output/UserRepository');
const UserModel = require('../../../../models/user.model');
const UserDomain = require('../../../../domain/model/User');

/**
 * Implementación del repositorio de usuarios usando Sequelize
 * Implementa el puerto UserRepository
 * Mapea entre el modelo ORM (UserModel) y la entidad de dominio (UserDomain)
 */
class UserRepositoryImpl extends UserRepositoryPort {
    constructor() {
        super();
    }

    /**
     * Busca un usuario por username (email)
     * @param {string} username - Email del usuario
     * @returns {Promise<UserDomain|null>} - Entidad de dominio User o null
     */
    async findByUsername(username) {
        try {
            const userModel = await UserModel.findOne({
                where: { username },
                include: [
                    {
                        association: 'user_type',
                        attributes: ['id', 'name']
                    },
                    {
                        association: 'customer',
                        attributes: ['tenantId']
                    }
                ]
            });

            if (!userModel) {
                return null;
            }

            // Mapear de modelo ORM a entidad de dominio
            return this.toDomain(userModel);
        } catch (error) {
            throw new Error(`Error finding user by username: ${error.message}`);
        }
    }

    /**
     * Busca un usuario por ID
     * @param {number} userId - ID del usuario
     * @returns {Promise<UserDomain|null>} - Entidad de dominio User o null
     */
    async findById(userId) {
        try {
            const userModel = await UserModel.findByPk(userId, {
                include: [
                    {
                        association: 'user_type',
                        attributes: ['id', 'name']
                    },
                    {
                        association: 'customer',
                        attributes: ['tenantId']
                    }
                ]
            });

            if (!userModel) {
                return null;
            }

            return this.toDomain(userModel);
        } catch (error) {
            throw new Error(`Error finding user by ID: ${error.message}`);
        }
    }

    /**
     * Actualiza la fecha del último login
     * @param {number} userId - ID del usuario
     * @param {Date} loginDate - Fecha del login
     * @returns {Promise<void>}
     */
    async updateLastLogin(userId, loginDate) {
        try {
            await UserModel.update(
                { last_login: loginDate },
                { where: { id: userId } }
            );
        } catch (error) {
            throw new Error(`Error updating last login: ${error.message}`);
        }
    }

    /**
     * Mapea de modelo ORM a entidad de dominio
     * @param {UserModel} userModel - Modelo Sequelize
     * @returns {UserDomain} - Entidad de dominio
     */
    toDomain(userModel) {
        const userData = userModel.get({ plain: true });

        // El constructor de User espera parámetros posicionales, no un objeto
        // constructor(id, username, contrasenia, id_user_type, user_type, status, last_login, created_at, updated_at, code_referial, auth_two_factor, tenantId)
        return new UserDomain(
            userData.id,
            userData.username,
            userData.password, // El campo en BD es 'contrasenia' pero Sequelize lo mapea como 'password'
            userData.id_user_type,
            userData.user_type ? userData.user_type.name : null, // Pasar solo el name como string
            userData.status,
            userData.last_login,
            userData.create_at,
            userData.update_at,
            userData.code_referral,
            userData.auth_two_factor,
            userData.customer ? userData.customer.tenantId : null // Obtener tenantId desde la relación con Customer
        );
    }
}

module.exports = UserRepositoryImpl;
