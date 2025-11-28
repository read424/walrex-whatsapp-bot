/**
 * Implementación del repositorio de conexiones de WhatsApp
 *
 * Responsabilidades:
 * - Persistir y recuperar datos de WhatsAppConnection
 * - Mapear entre modelos de Sequelize y entidades de dominio
 * - NO contiene lógica de negocio
 *
 * Esta es una clase de ADAPTADOR (capa de infraestructura - outbound/persistence)
 */

const { WhatsAppConnection } = require('./entity');

class WhatsAppConnectionRepositoryImpl {
    constructor() {
        this.model = WhatsAppConnection;
    }

    /**
     * Actualiza un registro de WhatsAppConnection
     * @param {string} connectionId - ID de la conexión
     * @param {Object} data - Datos a actualizar
     * @returns {Promise<Object>}
     */
    async update(connectionId, data) {
        try {
            // Buscar el registro por connection_id
            const record = await this.model.findOne({
                where: { connection_id: connectionId }
            });

            if (!record) {
                throw new Error(`WhatsAppConnection not found for connectionId: ${connectionId}`);
            }

            // Mapear campos del dominio a la base de datos
            const updateData = {};

            if (data.qrCode !== undefined) updateData.qr_code = data.qrCode;
            if (data.phoneNumber !== undefined) updateData.phone_number = data.phoneNumber;
            if (data.deviceInfo !== undefined) updateData.device_info = data.deviceInfo;
            if (data.status !== undefined) updateData.status = data.status;
            if (data.lastError !== undefined) updateData.last_error = data.lastError;
            if (data.lastSeen !== undefined) updateData.last_seen = data.lastSeen;

            // Actualizar el registro
            await record.update(updateData);

            return record;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Encuentra un registro por connection_id
     * @param {string} connectionId - ID de la conexión
     * @returns {Promise<Object|null>}
     */
    async findByConnectionId(connectionId) {
        try {
            const record = await this.model.findOne({
                where: { connection_id: connectionId }
            });

            return record;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Crea o encuentra un registro de WhatsAppConnection
     * @param {string} connectionId - ID de la conexión
     * @param {Object} defaults - Valores por defecto
     * @returns {Promise<Object>}
     */
    async findOrCreate(connectionId, defaults = {}) {
        try {
            const [record, created] = await this.model.findOrCreate({
                where: { connection_id: connectionId },
                defaults: {
                    connection_id: connectionId,
                    status: defaults.status || 'connecting',
                    qr_code: defaults.qrCode || null,
                    phone_number: defaults.phoneNumber || null,
                    device_info: defaults.deviceInfo || null,
                    last_seen: defaults.lastSeen || new Date()
                }
            });

            return { record, created };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Elimina un registro por connection_id
     * @param {string} connectionId - ID de la conexión
     * @returns {Promise<boolean>}
     */
    async delete(connectionId) {
        try {
            const result = await this.model.destroy({
                where: { connection_id: connectionId }
            });

            return result > 0;

        } catch (error) {
            throw error;
        }
    }
}

module.exports = WhatsAppConnectionRepositoryImpl;