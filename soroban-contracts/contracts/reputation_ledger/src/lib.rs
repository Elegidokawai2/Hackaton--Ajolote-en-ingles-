#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, IntoVal, Symbol};

// ─── Storage keys ───────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    WalletRegistryAddr,    // Address del contrato WalletRegistry
    Rep(Address, Symbol),  // (wallet, category) → u32  [anclado a la wallet del usuario]
    Banned(Address),       // wallet → bool
    Authorized(Address),   // contract → bool
}

// ─── Contrato ───────────────────────────────────────────────────────────────

#[contract]
pub struct ReputationLedger;

#[contractimpl]
impl ReputationLedger {

    // ── Inicialización ──────────────────────────────────────────────────

    /// Configura el admin y la dirección del WalletRegistry.
    /// La reputación está anclada a la wallet del usuario, que es la identidad
    /// on-chain emitida por WalletRegistry al momento del registro.
    pub fn initialize(env: Env, admin: Address, wallet_registry_addr: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::WalletRegistryAddr, &wallet_registry_addr);
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    // ── Autorizaciones ──────────────────────────────────────────────────

    /// Autoriza a un contrato (EventContract, ProjectContract) a modificar reputación.
    pub fn authorize_contract(env: Env, contract: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Authorized(contract), &true);
    }

    // ── Helpers internos ────────────────────────────────────────────────

    /// Verifica que la wallet esté registrada y activa en WalletRegistry.
    /// Se llama antes de cualquier modificación de reputación.
    fn require_registered_wallet(env: &Env, wallet: &Address) {
        let registry_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::WalletRegistryAddr)
            .unwrap();

        let is_active: bool = env.invoke_contract(
            &registry_addr,
            &Symbol::new(env, "is_active_by_wallet"),
            (wallet.clone(),).into_val(env),
        );

        if !is_active {
            panic!("user wallet is not registered or is inactive");
        }
    }

    // ── Consultas ───────────────────────────────────────────────────────

    /// Retorna la reputación de una wallet en una categoría.
    /// Retorna 0 si la wallet no tiene reputación registrada aún.
    pub fn get_reputation(env: Env, user: Address, category: Symbol) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Rep(user, category))
            .unwrap_or(0u32)
    }

    /// Consulta si una wallet está baneada.
    pub fn is_banned(env: Env, user: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Banned(user))
            .unwrap_or(false)
    }

    // ── Modificaciones ──────────────────────────────────────────────────

    /// Incrementa la reputación de una wallet en una categoría.
    /// Valida que la wallet esté registrada y activa en WalletRegistry antes de operar.
    /// Solo el admin puede llamar esta función.
    pub fn add_reputation(env: Env, caller: Address, user: Address, category: Symbol, delta: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        caller.require_auth();
        if caller != admin {
            panic!("only admin can add reputation");
        }

        // Verificar que la wallet existe y está activa antes de acreditar reputación
        Self::require_registered_wallet(&env, &user);

        let key = DataKey::Rep(user, category);
        let current: u32 = env.storage().persistent().get(&key).unwrap_or(0u32);
        env.storage().persistent().set(&key, &(current + delta));
    }

    /// Reduce la reputación de una wallet en una categoría.
    /// Valida registro y actividad. Solo el admin puede llamar esta función.
    pub fn remove_reputation(env: Env, caller: Address, user: Address, category: Symbol, delta: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        caller.require_auth();
        if caller != admin {
            panic!("only admin can remove reputation");
        }

        Self::require_registered_wallet(&env, &user);

        let key = DataKey::Rep(user, category);
        let current: u32 = env.storage().persistent().get(&key).unwrap_or(0u32);
        if delta > current {
            panic!("cannot reduce reputation below zero");
        }
        env.storage().persistent().set(&key, &(current - delta));
    }

    /// Marca una wallet como baneada. Solo el admin.
    pub fn shadowban(env: Env, caller: Address, user: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        caller.require_auth();
        if caller != admin {
            panic!("only admin can shadowban");
        }

        env.storage().persistent().set(&DataKey::Banned(user), &true);
    }

    /// Revierte el baneo de una wallet. Solo el admin.
    pub fn unban(env: Env, caller: Address, user: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        caller.require_auth();
        if caller != admin {
            panic!("only admin can unban");
        }

        env.storage().persistent().set(&DataKey::Banned(user), &false);
    }
}

mod test;