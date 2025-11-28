const ContactRepositoryPort = require('../../../../application/ports/output/ContactRepositoryPort');
const Contact = require('../../../../domain/model/Contact');
const ContactModel = require('./entity/Contact.model');

/**
 * Implementación del repositorio de contactos usando Sequelize
 * Esta clase pertenece a la capa de infraestructura y es la única que conoce Sequelize
 */
class ContactRepositoryImpl extends ContactRepositoryPort {
    async findByPhoneNumber(phoneNumber, tenantId) {
        const dbContact = await ContactModel.findOne({
            where: {
                phone_number: phoneNumber,
                tenant_id: tenantId
            }
        });

        if (!dbContact) {
            return null;
        }

        return Contact.fromDatabase(dbContact.toJSON());
    }

    async create(contactData) {
        const dbContact = await ContactModel.create({
            phone_number: contactData.phoneNumber,
            name: contactData.name,
            avatar_url: contactData.avatarUrl,
            metadata: contactData.metadata,
            tenant_id: contactData.tenantId
        });

        return Contact.fromDatabase(dbContact.toJSON());
    }

    async update(contactId, contactData) {
        const dbContact = await ContactModel.findByPk(contactId);

        if (!dbContact) {
            throw new Error(`Contact with id ${contactId} not found`);
        }

        if (contactData.name !== undefined) {
            dbContact.name = contactData.name;
        }
        if (contactData.avatarUrl !== undefined) {
            dbContact.avatar_url = contactData.avatarUrl;
        }
        if (contactData.metadata !== undefined) {
            dbContact.metadata = contactData.metadata;
        }

        await dbContact.save();

        return Contact.fromDatabase(dbContact.toJSON());
    }

    async findById(contactId) {
        const dbContact = await ContactModel.findByPk(contactId);

        if (!dbContact) {
            return null;
        }

        return Contact.fromDatabase(dbContact.toJSON());
    }

    async findByTenant(tenantId, options = {}) {
        const dbContacts = await ContactModel.findAll({
            where: { tenant_id: tenantId },
            order: [['created_at', 'DESC']],
            ...options
        });

        return dbContacts.map(dbContact => Contact.fromDatabase(dbContact.toJSON()));
    }
}

module.exports = ContactRepositoryImpl;