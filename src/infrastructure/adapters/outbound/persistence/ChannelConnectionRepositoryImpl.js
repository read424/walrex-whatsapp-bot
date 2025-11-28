const ChannelConnectionModel = require('./entity/ChannelConnection.model');
const ChannelConnection = require('../../../../domain/model/ChannelConnection');

/**
 * Implementación del repositorio de ChannelConnection
 * Adaptador de persistencia que interactúa con Sequelize
 */
class ChannelConnectionRepositoryImpl {
    constructor({ logger }) {
        this.logger = logger;
        this.model = ChannelConnectionModel;
    }

    /**
     * Crea una nueva conexión de canal
     */
    async create(channelConnection) {
        try {
            const data = channelConnection.toDatabase();
            const created = await this.model.create(data);

            this.logger.debug('ChannelConnectionRepository', 'Connection created', {
                id: created.id,
                channelType: created.channel_type
            });

            return ChannelConnection.fromDatabase(created);
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error creating connection', error);
            throw error;
        }
    }

    /**
     * Busca una conexión por ID
     */
    async findById(id) {
        try {
            const connection = await this.model.findByPk(id);
            return connection ? ChannelConnection.fromDatabase(connection) : null;
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error finding by ID', error, { id });
            throw error;
        }
    }

    /**
     * Busca una conexión por nombre y tenant
     */
    async findByNameAndTenant(connectionName, tenantId) {
        try {
            const connection = await this.model.findOne({
                where: {
                    connection_name: connectionName,
                    tenant_id: tenantId
                }
            });

            return connection ? ChannelConnection.fromDatabase(connection) : null;
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error finding by name and tenant', error, {
                connectionName,
                tenantId
            });
            throw error;
        }
    }

    /**
     * Busca conexión por clientId (para WhatsApp Web)
     */
    async findByClientId(clientId) {
        try {
            const connection = await this.model.findOne({
                where: {
                    channel_type: 'whatsapp_web',
                    channel_config: {
                        clientId: clientId
                    }
                }
            });

            return connection ? ChannelConnection.fromDatabase(connection) : null;
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error finding by clientId', error, { clientId });
            throw error;
        }
    }

    /**
     * Obtiene todas las conexiones de un tenant
     */
    async findByTenant(tenantId, options = {}) {
        try {
            const where = { tenant_id: tenantId };

            if (options.isActive !== undefined) {
                where.is_active = options.isActive;
            }

            if (options.channelType) {
                where.channel_type = options.channelType;
            }

            if (options.status) {
                where.status = options.status;
            }

            const connections = await this.model.findAll({
                where,
                order: [['created_at', 'DESC']]
            });

            return connections.map(conn => ChannelConnection.fromDatabase(conn));
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error finding by tenant', error, { tenantId });
            throw error;
        }
    }

    /**
     * Obtiene conexiones activas de un tenant
     */
    async findActiveByTenant(tenantId) {
        return await this.findByTenant(tenantId, {
            isActive: true,
            status: ['active', 'authenticated']
        });
    }

    /**
     * Obtiene conexiones por tipo de canal
     */
    async findByChannelType(channelType, tenantId = null) {
        try {
            const where = { channel_type: channelType };

            if (tenantId) {
                where.tenant_id = tenantId;
            }

            const connections = await this.model.findAll({
                where,
                order: [['created_at', 'DESC']]
            });

            return connections.map(conn => ChannelConnection.fromDatabase(conn));
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error finding by channel type', error, {
                channelType,
                tenantId
            });
            throw error;
        }
    }

    /**
     * Actualiza una conexión
     */
    async update(id, updates) {
        try {
            const connection = await this.model.findByPk(id);

            if (!connection) {
                return null;
            }

            await connection.update(updates);

            this.logger.debug('ChannelConnectionRepository', 'Connection updated', { id });

            return ChannelConnection.fromDatabase(connection);
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error updating connection', error, { id });
            throw error;
        }
    }

    /**
     * Actualiza el estado de una conexión
     */
    async updateStatus(id, status, error = null) {
        try {
            const updates = {
                status,
                last_seen: new Date()
            };

            if (error) {
                updates.last_error = error;
                updates.connection_attempts = this.model.sequelize.literal('connection_attempts + 1');
            } else if (status === 'active' || status === 'authenticated') {
                updates.last_error = null;
                updates.connection_attempts = 0;
            }

            const [affectedRows] = await this.model.update(updates, {
                where: { id }
            });

            this.logger.debug('ChannelConnectionRepository', 'Status updated', { id, status });

            return affectedRows > 0;
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error updating status', error, { id, status });
            throw error;
        }
    }

    /**
     * Actualiza la metadata de una conexión
     */
    async updateMetadata(id, metadata) {
        try {
            const connection = await this.model.findByPk(id);

            if (!connection) {
                return null;
            }

            const updatedMetadata = {
                ...connection.connection_metadata,
                ...metadata,
                lastUpdate: new Date().toISOString()
            };

            await connection.update({
                connection_metadata: updatedMetadata
            });

            this.logger.debug('ChannelConnectionRepository', 'Metadata updated', { id });

            return ChannelConnection.fromDatabase(connection);
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error updating metadata', error, { id });
            throw error;
        }
    }

    /**
     * Actualiza la configuración del canal
     */
    async updateChannelConfig(id, config) {
        try {
            const connection = await this.model.findByPk(id);

            if (!connection) {
                return null;
            }

            const updatedConfig = {
                ...connection.channel_config,
                ...config
            };

            await connection.update({
                channel_config: updatedConfig
            });

            this.logger.debug('ChannelConnectionRepository', 'Channel config updated', { id });

            return ChannelConnection.fromDatabase(connection);
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error updating channel config', error, { id });
            throw error;
        }
    }

    /**
     * Elimina una conexión (soft delete)
     */
    async delete(id) {
        try {
            const [affectedRows] = await this.model.update(
                { is_active: false, status: 'inactive' },
                { where: { id } }
            );

            this.logger.debug('ChannelConnectionRepository', 'Connection deleted (soft)', { id });

            return affectedRows > 0;
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error deleting connection', error, { id });
            throw error;
        }
    }

    /**
     * Elimina permanentemente una conexión
     */
    async hardDelete(id) {
        try {
            const affectedRows = await this.model.destroy({
                where: { id }
            });

            this.logger.debug('ChannelConnectionRepository', 'Connection hard deleted', { id });

            return affectedRows > 0;
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error hard deleting connection', error, { id });
            throw error;
        }
    }

    /**
     * Cuenta conexiones por tipo
     */
    async countByChannelType(tenantId) {
        try {
            const counts = await this.model.findAll({
                attributes: [
                    'channel_type',
                    [this.model.sequelize.fn('COUNT', this.model.sequelize.col('id')), 'count']
                ],
                where: {
                    tenant_id: tenantId,
                    is_active: true
                },
                group: ['channel_type'],
                raw: true
            });

            return counts;
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error counting by channel type', error, { tenantId });
            throw error;
        }
    }

    /**
     * Obtiene conexiones que necesitan reconexión
     */
    async findNeedingReconnect(maxAttempts = 5) {
        try {
            const connections = await this.model.findAll({
                where: {
                    status: ['error', 'disconnected'],
                    is_active: true,
                    connection_attempts: {
                        [this.model.sequelize.Op.lt]: maxAttempts
                    }
                },
                order: [
                    ['connection_attempts', 'ASC'],
                    ['updated_at', 'ASC']
                ]
            });

            return connections.map(conn => ChannelConnection.fromDatabase(conn));
        } catch (error) {
            this.logger.error('ChannelConnectionRepository', 'Error finding connections needing reconnect', error);
            throw error;
        }
    }
}

module.exports = ChannelConnectionRepositoryImpl;