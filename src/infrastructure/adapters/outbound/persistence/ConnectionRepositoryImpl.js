const ConnectionRepositoryPort = require('../../../../application/ports/output/ConnectionRepositoryPort');
const ConnectionModel = require('../../../../models/Connection.model');
const ConnectionDomain = require('../../../../domain/model/Connection');

/**
 * Implementación del repositorio de conexiones usando Sequelize
 * Implementa el puerto ConnectionRepositoryPort
 * Mapea entre el modelo ORM (ConnectionModel) y la entidad de dominio (ConnectionDomain)
 */
class ConnectionRepositoryImpl extends ConnectionRepositoryPort {
    constructor() {
        super();
    }

    /**
     * Busca una conexión por ID
     * @param {number} connectionId - ID de la conexión
     * @returns {Promise<ConnectionDomain|null>}
     */
    async findById(connectionId) {
        try {
            const connectionModel = await ConnectionModel.findByPk(connectionId);

            if (!connectionModel) {
                return null;
            }

            return this.toDomain(connectionModel);
        } catch (error) {
            throw new Error(`Error finding connection by ID: ${error.message}`);
        }
    }

    /**
     * Busca todas las conexiones de un tenant con filtros opcionales
     * @param {string|number} tenantId - ID del tenant
     * @param {Object} filters - Filtros opcionales (status, providerType)
     * @returns {Promise<ConnectionDomain[]>}
     */
    async findByTenant(tenantId, filters = {}) {
        try {
            const where = { tenant_id: tenantId };

            // Aplicar filtros opcionales
            if (filters.status) {
                where.status = filters.status;
            }

            if (filters.providerType) {
                where.provider_type = filters.providerType;
            }

            const connectionModels = await ConnectionModel.findAll({
                where,
                order: [['created_at', 'DESC']]
            });

            return connectionModels.map(model => this.toDomain(model));
        } catch (error) {
            throw new Error(`Error finding connections by tenant: ${error.message}`);
        }
    }

    /**
     * Busca una conexión por nombre dentro de un tenant
     * @param {string} connectionName - Nombre de la conexión
     * @param {string|number} tenantId - ID del tenant
     * @returns {Promise<ConnectionDomain|null>}
     */
    async findByName(connectionName, tenantId) {
        try {
            const connectionModel = await ConnectionModel.findOne({
                where: {
                    connection_name: connectionName,
                    tenant_id: tenantId
                }
            });

            if (!connectionModel) {
                return null;
            }

            return this.toDomain(connectionModel);
        } catch (error) {
            throw new Error(`Error finding connection by name: ${error.message}`);
        }
    }

    /**
     * Crea una nueva conexión
     * @param {ConnectionDomain} connection - Entidad de dominio
     * @returns {Promise<ConnectionDomain>}
     */
    async create(connection) {
        try {
            const persistenceData = this.toPersistence(connection);
            
            const connectionModel = await ConnectionModel.create(persistenceData);

            return this.toDomain(connectionModel);
        } catch (error) {
            throw new Error(`Error creating connection: ${error.message}`);
        }
    }

    /**
     * Actualiza una conexión existente
     * @param {ConnectionDomain} connection - Entidad de dominio con cambios
     * @returns {Promise<ConnectionDomain>}
     */
    async update(connection) {
        try {
            const persistenceData = this.toPersistence(connection);

            await ConnectionModel.update(persistenceData, {
                where: { id: connection.id }
            });

            // Recuperar el modelo actualizado
            const updatedModel = await ConnectionModel.findByPk(connection.id);

            if (!updatedModel) {
                throw new Error(`Connection with ID ${connection.id} not found after update`);
            }

            return this.toDomain(updatedModel);
        } catch (error) {
            throw new Error(`Error updating connection: ${error.message}`);
        }
    }

    /**
     * Elimina una conexión por ID
     * @param {number} connectionId - ID de la conexión
     * @returns {Promise<boolean>}
     */
    async delete(connectionId) {
        try {
            const deleted = await ConnectionModel.destroy({
                where: { id: connectionId }
            });

            return deleted > 0;
        } catch (error) {
            throw new Error(`Error deleting connection: ${error.message}`);
        }
    }

    /**
     * Actualiza el estado de una conexión
     * @param {number} connectionId - ID de la conexión
     * @param {string} newStatus - Nuevo estado
     * @returns {Promise<ConnectionDomain>}
     */
    async updateStatus(connectionId, newStatus) {
        try {
            await ConnectionModel.update(
                { 
                    status: newStatus,
                    updated_at: new Date()
                },
                { where: { id: connectionId } }
            );

            const updatedModel = await ConnectionModel.findByPk(connectionId);

            if (!updatedModel) {
                throw new Error(`Connection with ID ${connectionId} not found`);
            }

            return this.toDomain(updatedModel);
        } catch (error) {
            throw new Error(`Error updating connection status: ${error.message}`);
        }
    }

    /**
     * Actualiza el QR code de una conexión
     * @param {number} connectionId - ID de la conexión
     * @param {string} qrCode - Código QR en base64
     * @returns {Promise<ConnectionDomain>}
     */
    async updateQRCode(connectionId, qrCode) {
        try {
            // El QR code se puede almacenar en el campo 'settings' como JSON
            const connection = await ConnectionModel.findByPk(connectionId);

            if (!connection) {
                throw new Error(`Connection with ID ${connectionId} not found`);
            }

            const settings = connection.settings || {};
            settings.qrCode = qrCode;
            settings.qrCodeUpdatedAt = new Date().toISOString();

            await ConnectionModel.update(
                { 
                    settings,
                    updated_at: new Date()
                },
                { where: { id: connectionId } }
            );

            const updatedModel = await ConnectionModel.findByPk(connectionId);

            return this.toDomain(updatedModel);
        } catch (error) {
            throw new Error(`Error updating connection QR code: ${error.message}`);
        }
    }

    /**
     * Mapea de modelo ORM a entidad de dominio
     * @param {ConnectionModel} connectionModel - Modelo Sequelize
     * @returns {ConnectionDomain}
     */
    toDomain(connectionModel) {
        const data = connectionModel.get({ plain: true });

        return new ConnectionDomain({
            id: data.id,
            connectionName: data.connection_name,
            providerType: data.provider_type,
            department: data.department,
            welcomeMessage: data.welcome_message,
            goodbyeMessage: data.goodbye_message,
            chatbotTimeout: data.chatbot_timeout,
            tenantId: data.tenant_id,
            status: data.status,
            qrCode: data.settings?.qrCode || null,
            phoneNumber: data.settings?.phoneNumber || null,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        });
    }

    /**
     * Mapea de entidad de dominio a modelo ORM
     * @param {ConnectionDomain} connectionDomain - Entidad de dominio
     * @returns {Object}
     */
    toPersistence(connectionDomain) {
        // Preparar settings JSON
        const settings = {};
        if (connectionDomain.qrCode) {
            settings.qrCode = connectionDomain.qrCode;
        }
        if (connectionDomain.phoneNumber) {
            settings.phoneNumber = connectionDomain.phoneNumber;
        }

        return {
            id: connectionDomain.id,
            connection_name: connectionDomain.connectionName,
            provider_type: connectionDomain.providerType,
            department: connectionDomain.department,
            welcome_message: connectionDomain.welcomeMessage,
            goodbye_message: connectionDomain.goodbyeMessage,
            chatbot_timeout: connectionDomain.chatbotTimeout,
            tenant_id: connectionDomain.tenantId,
            status: connectionDomain.status,
            settings: Object.keys(settings).length > 0 ? settings : null,
            is_active: true,
            updated_at: new Date()
        };
    }
}

module.exports = ConnectionRepositoryImpl;
