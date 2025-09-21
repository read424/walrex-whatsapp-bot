const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');

class Contact extends Model {
    static associate(models) {
        // Un contacto puede tener muchas sesiones de chat
        Contact.hasMany(models.ChatSession, {
            foreignKey: 'contact_id',
            sourceKey: 'id'
        });

        // Un contacto puede tener muchos mensajes
        Contact.hasMany(models.ChatMessage, {
            foreignKey: 'contact_id',
            sourceKey: 'id'
        });

        // Un contacto pertenece a una conexión
        Contact.belongsTo(models.Connection, {
            foreignKey: 'connection_id',
            targetKey: 'id'
        });
    }
}

Contact.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    phone_number: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        comment: 'Número de teléfono único del contacto'
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Nombre del contacto'
    },
    avatar_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'URL del avatar del contacto'
    },
    metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Información adicional como empresa, tags, etc.'
    },
    tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Identificador del tenant para multitenancy'
    }
}, {
    sequelize,
    modelName: 'Contact',
    tableName: 'contacts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['phone_number'],
            name: 'idx_contacts_phone'
        },
        {
            fields: ['tenant_id'],
            name: 'idx_contacts_tenant'
        }
    ]
});

// Métodos de instancia útiles
Contact.prototype.getFullName = function() {
    return this.name || this.phone_number;
};

Contact.prototype.isActive = function() {
    return this.metadata?.status !== 'blocked';
};

Contact.prototype.addTag = function(tag) {
    if (!this.metadata) {
        this.metadata = {};
    }
    if (!this.metadata.tags) {
        this.metadata.tags = [];
    }
    if (!this.metadata.tags.includes(tag)) {
        this.metadata.tags.push(tag);
    }
};

Contact.prototype.removeTag = function(tag) {
    if (this.metadata?.tags) {
        this.metadata.tags = this.metadata.tags.filter(t => t !== tag);
    }
};

// Métodos estáticos
Contact.findByPhoneNumber = async function(phoneNumber, tenantId = null) {
    const where = { phone_number: phoneNumber };
    if (tenantId) {
        where.tenant_id = tenantId;
    }
    
    return await this.findOne({ where });
};

Contact.findByTenant = async function(tenantId, options = {}) {
    const queryOptions = {
        where: { tenant_id: tenantId },
        order: [['created_at', 'DESC']],
        ...options
    };
    
    return await this.findAll(queryOptions);
};

Contact.createOrUpdate = async function(contactData) {
    const { phone_number, tenant_id } = contactData;
    
    let contact = await this.findByPhoneNumber(phone_number, tenant_id);
    
    if (contact) {
        // Actualizar contacto existente
        await contact.update(contactData);
        return contact;
    } else {
        // Crear nuevo contacto
        return await this.create(contactData);
    }
};

module.exports = Contact;
