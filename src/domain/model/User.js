class User {
    constructor(id,
        username,
        contrasenia,
        id_user_type,
        user_type,
        status,
        last_login,
        created_at,
        updated_at,
        code_referial,
        auth_two_factor,
        tenantId = null
    ){
        this.id = id;
        this.username = username;
        this.contrasenia = contrasenia;
        this.id_user_type = id_user_type;
        this.role = user_type;
        this.status = status;
        this.last_login = last_login;
        this.created_at = created_at;
        this.updated_at = updated_at;
        this.code_referial = code_referial;
        this.auth_two_factor = auth_two_factor;
        this.tenantId = tenantId;
    }

    isActive(){
        return this.status === '1';
    }

    isEmployee(){
        const employeeTypes = ['agent', 'supervisor', 'admin'];
        return employeeTypes.includes(this.role);
    }

    canAccessSalesPanel() {
        return this.isActive() && this.isEmployee();
    }

    toJSON() {
        return {
            id: this.id,
            username: this.username,
            id_user_type: this.id_user_type,
            role: this.role,
            status: this.status,
            last_login: this.last_login,
            create_at: this.create_at,
            update_at: this.update_at,
            code_referial: this.code_referial,
            auth_two_factor: this.auth_two_factor,
            tenantId: this.tenantId
        };
    }

}

module.exports = User;