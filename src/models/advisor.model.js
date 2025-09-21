const { Model, DataTypes } = require('sequelize');
const sequelize = require('../infrastructure/config/DatabaseConfig');

class Advisor extends Model {
    static associate(models) {
        // Un asesor puede manejar muchas sesiones
        Advisor.hasMany(models.ChatSession, {
            foreignKey: 'handled_by',
            sourceKey: 'id'
        });

        // Un asesor puede responder muchos mensajes
        Advisor.hasMany(models.ChatMessage, {
            foreignKey: 'responded_by',
            sourceKey: 'id'
        });
    }
}

Advisor.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Nombre completo del asesor'
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Email único del asesor'
    },
    role: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'agent',
        comment: 'Rol del asesor'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si el asesor está activo'
    },
    tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Identificador del tenant para multitenancy'
    },
    settings: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Configuraciones personales del asesor'
    }
}, { 
    sequelize,
    modelName: 'Advisor',
    tableName: 'advisors',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Métodos de instancia útiles
Advisor.prototype.isActive = function() {
    return this.is_active === true;
};

Advisor.prototype.activate = async function() {
    this.is_active = true;
    return await this.save();
};

Advisor.prototype.deactivate = async function() {
    this.is_active = false;
    return await this.save();
};

Advisor.prototype.isAgent = function() {
    return this.role === 'agent';
};

Advisor.prototype.isSupervisor = function() {
    return this.role === 'supervisor';
};

Advisor.prototype.isAdmin = function() {
    return this.role === 'admin';
};

Advisor.prototype.getSetting = function(key, defaultValue = null) {
    if (!this.settings) {
        return defaultValue;
    }
    return this.settings[key] || defaultValue;
};

Advisor.prototype.setSetting = async function(key, value) {
    if (!this.settings) {
        this.settings = {};
    }
    this.settings[key] = value;
    return await this.save();
};

// Métodos estáticos
Advisor.findActiveByTenant = async function(tenantId) {
    return await this.findAll({
        where: {
            tenant_id: tenantId,
            is_active: true
        },
        order: [['name', 'ASC']]
    });
};

Advisor.findByRole = async function(role, tenantId = null) {
    const where = { role };
    if (tenantId) {
        where.tenant_id = tenantId;
    }
    
    return await this.findAll({
        where,
        order: [['name', 'ASC']]
    });
};

Advisor.findByEmail = async function(email, tenantId = null) {
    const where = { email };
    if (tenantId) {
        where.tenant_id = tenantId;
    }
    
    return await this.findOne({ where });
};

Advisor.createAdvisor = async function(advisorData) {
    const advisor = await this.create({
        ...advisorData,
        is_active: true,
        role: advisorData.role || 'agent'
    });
    return advisor;
};

module.exports = Advisor;