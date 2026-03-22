#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, BytesN, Env, Symbol,
};

// ─── Modelo de datos ──────────────────────────────────────────────────────────

/// Roles posibles de un usuario dentro de la plataforma.
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum UserRole {
    Recruiter,
    Freelancer,
}

/// Datos asociados a un usuario registrado.
#[derive(Clone, Debug)]
#[contracttype]
pub struct UserProfile {
    pub wallet: Address,         // Public key de la wallet custodial del usuario
    pub role: UserRole,          // Rol en la plataforma
    pub email_hash: BytesN<32>,  // SHA-256 del email (privacidad on-chain)
    pub active: bool,            // El admin puede desactivar una cuenta
}

// ─── Claves de almacenamiento ─────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,                        // Address del administrador de la plataforma
    UserByEmail(BytesN<32>),      // email_hash → UserProfile
    EmailByWallet(Address),       // wallet → email_hash (índice inverso)
}

// ─── Contrato ─────────────────────────────────────────────────────────────────

#[contract]
pub struct WalletRegistry;

#[contractimpl]
impl WalletRegistry {

    // ── Inicialización ────────────────────────────────────────────────────────

    /// Configura el admin del contrato. Solo se puede llamar una vez.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    // ── Registro de usuarios ──────────────────────────────────────────────────

    /// Registra un nuevo usuario asociando su email_hash a una wallet y un rol.
    ///
    /// Solo el admin puede llamar esta función (el backend firma como admin).
    /// El email_hash es el SHA-256 del email del usuario, calculado en el backend.
    /// La wallet es el public key del Keypair custodial generado por el backend.
    pub fn register_user(
        env: Env,
        admin: Address,
        email_hash: BytesN<32>,
        wallet: Address,
        role: UserRole,
    ) {
        // Verificar que quien llama es el admin registrado
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if admin != stored_admin {
            panic!("only admin can register users");
        }

        // Evitar registro duplicado por email
        if env.storage().persistent().has(&DataKey::UserByEmail(email_hash.clone())) {
            panic!("email already registered");
        }

        // Evitar que una misma wallet se registre dos veces
        if env.storage().persistent().has(&DataKey::EmailByWallet(wallet.clone())) {
            panic!("wallet already registered");
        }

        let profile = UserProfile {
            wallet: wallet.clone(),
            role,
            email_hash: email_hash.clone(),
            active: true,
        };

        // Guardar en ambos índices
        env.storage()
            .persistent()
            .set(&DataKey::UserByEmail(email_hash.clone()), &profile);
        env.storage()
            .persistent()
            .set(&DataKey::EmailByWallet(wallet), &email_hash);
    }

    // ── Actualización de wallet ───────────────────────────────────────────────

    /// Reemplaza la wallet asociada a un email_hash.
    /// Útil si el backend necesita rotar las claves de un usuario.
    /// Solo el admin puede ejecutar esta operación.
    pub fn update_wallet(
        env: Env,
        admin: Address,
        email_hash: BytesN<32>,
        new_wallet: Address,
    ) {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if admin != stored_admin {
            panic!("only admin can update wallets");
        }

        let mut profile: UserProfile = env
            .storage()
            .persistent()
            .get(&DataKey::UserByEmail(email_hash.clone()))
            .unwrap_or_else(|| panic!("user not found"));

        // Verificar que la nueva wallet no esté ya tomada por otro usuario
        if env.storage().persistent().has(&DataKey::EmailByWallet(new_wallet.clone())) {
            panic!("new wallet already registered to another user");
        }

        // Eliminar el índice inverso de la wallet antigua
        env.storage()
            .persistent()
            .remove(&DataKey::EmailByWallet(profile.wallet.clone()));

        // Actualizar
        profile.wallet = new_wallet.clone();
        env.storage()
            .persistent()
            .set(&DataKey::UserByEmail(email_hash.clone()), &profile);
        env.storage()
            .persistent()
            .set(&DataKey::EmailByWallet(new_wallet), &email_hash);
    }

    // ── Activación / desactivación ────────────────────────────────────────────

    /// Desactiva la cuenta de un usuario (shadowban a nivel de identidad).
    /// Los contratos de eventos/proyectos pueden consultar `is_active` antes de operar.
    pub fn deactivate_user(env: Env, admin: Address, email_hash: BytesN<32>) {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if admin != stored_admin {
            panic!("only admin can deactivate users");
        }

        let mut profile: UserProfile = env
            .storage()
            .persistent()
            .get(&DataKey::UserByEmail(email_hash.clone()))
            .unwrap_or_else(|| panic!("user not found"));

        profile.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::UserByEmail(email_hash), &profile);
    }

    /// Reactiva una cuenta previamente desactivada.
    pub fn activate_user(env: Env, admin: Address, email_hash: BytesN<32>) {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if admin != stored_admin {
            panic!("only admin can activate users");
        }

        let mut profile: UserProfile = env
            .storage()
            .persistent()
            .get(&DataKey::UserByEmail(email_hash.clone()))
            .unwrap_or_else(|| panic!("user not found"));

        profile.active = true;
        env.storage()
            .persistent()
            .set(&DataKey::UserByEmail(email_hash), &profile);
    }

    // ── Consultas ─────────────────────────────────────────────────────────────

    /// Retorna el perfil completo de un usuario dado su email_hash.
    pub fn get_user_by_email(env: Env, email_hash: BytesN<32>) -> UserProfile {
        env.storage()
            .persistent()
            .get(&DataKey::UserByEmail(email_hash))
            .unwrap_or_else(|| panic!("user not found"))
    }

    /// Retorna el perfil de un usuario dado su wallet address (índice inverso).
    pub fn get_user_by_wallet(env: Env, wallet: Address) -> UserProfile {
        let email_hash: BytesN<32> = env
            .storage()
            .persistent()
            .get(&DataKey::EmailByWallet(wallet))
            .unwrap_or_else(|| panic!("wallet not registered"));

        env.storage()
            .persistent()
            .get(&DataKey::UserByEmail(email_hash))
            .unwrap()
    }

    /// Retorna solo la wallet address de un usuario dado su email_hash.
    /// Función de conveniencia para que EventContract y ProjectContract
    /// puedan resolver email_hash → Address sin cargar el perfil completo.
    pub fn get_wallet(env: Env, email_hash: BytesN<32>) -> Address {
        let profile: UserProfile = env
            .storage()
            .persistent()
            .get(&DataKey::UserByEmail(email_hash))
            .unwrap_or_else(|| panic!("user not found"));

        profile.wallet
    }

    /// Indica si un usuario está activo.
    pub fn is_active(env: Env, email_hash: BytesN<32>) -> bool {
        let profile: UserProfile = env
            .storage()
            .persistent()
            .get(&DataKey::UserByEmail(email_hash))
            .unwrap_or_else(|| panic!("user not found"));

        profile.active
    }
 
    /// Consulta actividad por wallet Address.
    /// Usada por EventContract, ProjectContract y ReputationLedger
    /// en cross-contract calls, ya que estos contratos solo conocen el Address.
    pub fn is_active_by_wallet(env: Env, wallet: Address) -> bool {
        let email_hash: BytesN<32> = env
            .storage()
            .persistent()
            .get(&DataKey::EmailByWallet(wallet))
            .unwrap_or_else(|| panic!("wallet not registered"));
 
        let profile: UserProfile = env
            .storage()
            .persistent()
            .get(&DataKey::UserByEmail(email_hash))
            .unwrap();
 
        profile.active
    }
 
    /// Consulta el rol de un usuario por su wallet Address.
    /// Permite que EventContract valide que el reclutador tenga rol Recruiter
    /// y el freelancer tenga rol Freelancer.
    pub fn get_role_by_wallet(env: Env, wallet: Address) -> UserRole {
        let email_hash: BytesN<32> = env
            .storage()
            .persistent()
            .get(&DataKey::EmailByWallet(wallet))
            .unwrap_or_else(|| panic!("wallet not registered"));
 
        let profile: UserProfile = env
            .storage()
            .persistent()
            .get(&DataKey::UserByEmail(email_hash))
            .unwrap();
 
        profile.role
    }

    /// Indica si un email_hash ya está registrado.
    pub fn is_registered(env: Env, email_hash: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::UserByEmail(email_hash))
    }
}

mod test;