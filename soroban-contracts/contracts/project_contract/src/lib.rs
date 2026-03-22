#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, BytesN, Env, IntoVal, Symbol,
};

// ─── Data types ──────────────────────────────────────────────────────────────

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum ProjectStatus {
    Created,
    Active,
    Delivered,
    Correcting,
    Disputed,
    Completed,
    Cancelled,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct ProjectData {
    pub recruiter: Address,
    pub freelancer: Address,
    pub amount: i128,
    pub guarantee: i128,
    pub deadline: u64,
    pub status: ProjectStatus,
    pub delivery_hash: BytesN<32>,
    pub correction_count: u32,
    pub category: Symbol,
}

// ─── Storage keys ────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    ReputationAddr,
    PlatformAddr,
    WalletRegistryAddr,  // Address del contrato WalletRegistry
    Project(u64),
    Counter,
}

// ─── Contrato ────────────────────────────────────────────────────────────────

#[contract]
pub struct ProjectContract;

#[contractimpl]
impl ProjectContract {

    // ── Inicialización ────────────────────────────────────────────────────────

    /// Configura admin, token, reputación, plataforma y WalletRegistry.
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        reputation_addr: Address,
        platform_addr: Address,
        wallet_registry_addr: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::ReputationAddr, &reputation_addr);
        env.storage().instance().set(&DataKey::PlatformAddr, &platform_addr);
        env.storage().instance().set(&DataKey::WalletRegistryAddr, &wallet_registry_addr);
        env.storage().instance().set(&DataKey::Counter, &0u64);
    }

    // ── Helpers internos ──────────────────────────────────────────────────────

    /// Verifica que una wallet esté registrada y activa en WalletRegistry.
    fn require_active_wallet(env: &Env, wallet: &Address) {
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

    /// Verifica que una wallet tenga el rol esperado.
    fn require_role(env: &Env, wallet: &Address, expected_role_tag: &str) {
        let registry_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::WalletRegistryAddr)
            .unwrap();

        let role_val: Symbol = env.invoke_contract(
            &registry_addr,
            &Symbol::new(env, "get_role_by_wallet"),
            (wallet.clone(),).into_val(env),
        );

        if role_val != Symbol::new(env, expected_role_tag) {
            panic!("wallet does not have the required role for this operation");
        }
    }

    /// Helper interno para actualizar reputación via cross-contract call.
    fn update_reputation(env: &Env, user: &Address, category: &Symbol, delta: u32) {
        let reputation_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::ReputationAddr)
            .unwrap();
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

        env.invoke_contract::<()>(
            &reputation_addr,
            &Symbol::new(env, "add_reputation"),
            (admin, user.clone(), category.clone(), delta).into_val(env),
        );
    }

    // ── Creación de proyectos ─────────────────────────────────────────────────

    /// Crea un nuevo proyecto. El reclutador y el freelancer deben estar
    /// registrados y activos en WalletRegistry con sus roles correspondientes.
    /// El reclutador deposita amount + guarantee en escrow.
    pub fn create_project(
        env: Env,
        recruiter: Address,
        freelancer: Address,
        amount: i128,
        guarantee: i128,
        deadline: u64,
        category: Symbol,
    ) -> u64 {
        recruiter.require_auth();

        // Validar reclutador: debe existir, estar activo y tener rol Recruiter
        Self::require_active_wallet(&env, &recruiter);
        Self::require_role(&env, &recruiter, "Recruiter");

        // Validar freelancer: debe existir, estar activo y tener rol Freelancer
        Self::require_active_wallet(&env, &freelancer);
        Self::require_role(&env, &freelancer, "Freelancer");

        if amount <= 0 {
            panic!("amount must be positive");
        }
        if guarantee < 0 {
            panic!("guarantee must be non-negative");
        }

        let now = env.ledger().timestamp();
        let one_day_secs: u64 = 24 * 60 * 60;
        if deadline < now + one_day_secs {
            panic!("deadline must be at least 1 day from now");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&recruiter, &env.current_contract_address(), &(amount + guarantee));

        let mut counter: u64 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        counter += 1;
        env.storage().instance().set(&DataKey::Counter, &counter);

        let empty_hash = BytesN::from_array(&env, &[0u8; 32]);
        let project = ProjectData {
            recruiter,
            freelancer,
            amount,
            guarantee,
            deadline,
            status: ProjectStatus::Created,
            delivery_hash: empty_hash,
            correction_count: 0,
            category,
        };
        env.storage().persistent().set(&DataKey::Project(counter), &project);

        counter
    }

    // ── Aceptación ────────────────────────────────────────────────────────────

    /// El freelancer asignado acepta el proyecto.
    /// Se valida que siga activo al momento de aceptar.
    pub fn accept_project(env: Env, project_id: u64, freelancer: Address) {
        freelancer.require_auth();

        // Re-validar actividad al momento de aceptar (puede haber sido desactivado después)
        Self::require_active_wallet(&env, &freelancer);

        let mut project: ProjectData = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap();

        if project.status != ProjectStatus::Created {
            panic!("project is not in Created status");
        }
        if project.freelancer != freelancer {
            panic!("only the assigned freelancer can accept");
        }

        project.status = ProjectStatus::Active;
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    // ── Entrega ───────────────────────────────────────────────────────────────

    /// El freelancer envía su entregable.
    pub fn submit_delivery(
        env: Env,
        project_id: u64,
        freelancer: Address,
        delivery_hash: BytesN<32>,
    ) {
        freelancer.require_auth();

        let mut project: ProjectData = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap();

        if project.freelancer != freelancer {
            panic!("only the assigned freelancer can submit");
        }
        if project.status != ProjectStatus::Active && project.status != ProjectStatus::Correcting {
            panic!("project must be Active or Correcting to submit delivery");
        }

        project.delivery_hash = delivery_hash;
        project.status = ProjectStatus::Delivered;
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    // ── Aprobación ────────────────────────────────────────────────────────────

    /// El reclutador aprueba la entrega. El pago va directo a la wallet custodial del freelancer.
    pub fn approve_delivery(env: Env, project_id: u64, recruiter: Address) {
        recruiter.require_auth();

        let mut project: ProjectData = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap();

        if project.recruiter != recruiter {
            panic!("only the recruiter can approve");
        }
        if project.status != ProjectStatus::Delivered {
            panic!("project must be in Delivered status");
        }

        let platform: Address = env.storage().instance().get(&DataKey::PlatformAddr).unwrap();
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        let total_escrow = project.amount + project.guarantee;
        let commission = total_escrow * 7 / 100;
        let payout = total_escrow - commission;

        token_client.transfer(&env.current_contract_address(), &platform, &commission);
        // Pago directo a la wallet custodial del freelancer
        token_client.transfer(&env.current_contract_address(), &project.freelancer, &payout);

        Self::update_reputation(&env, &project.freelancer, &project.category, 5);

        project.status = ProjectStatus::Completed;
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    // ── Correcciones ──────────────────────────────────────────────────────────

    pub fn request_correction(env: Env, project_id: u64, recruiter: Address) {
        recruiter.require_auth();

        let mut project: ProjectData = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap();

        if project.recruiter != recruiter {
            panic!("only the recruiter can request corrections");
        }
        if project.status != ProjectStatus::Delivered {
            panic!("project must be in Delivered status");
        }
        if project.correction_count >= 2 {
            panic!("maximum correction rounds reached");
        }

        project.correction_count += 1;
        project.status = ProjectStatus::Correcting;
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    // ── Rechazo → disputa ─────────────────────────────────────────────────────

    pub fn reject_delivery(env: Env, project_id: u64, recruiter: Address) {
        recruiter.require_auth();

        let mut project: ProjectData = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap();

        if project.recruiter != recruiter {
            panic!("only the recruiter can reject");
        }
        if project.status != ProjectStatus::Delivered {
            panic!("project must be in Delivered status");
        }

        project.status = ProjectStatus::Disputed;
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    // ── Resolución de disputas ────────────────────────────────────────────────

    pub fn resolve_dispute(
        env: Env,
        project_id: u64,
        admin: Address,
        favor_freelancer: bool,
    ) {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if admin != stored_admin {
            panic!("only admin can resolve disputes");
        }

        let mut project: ProjectData = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap();

        if project.status != ProjectStatus::Disputed {
            panic!("project must be in Disputed status");
        }

        let platform: Address = env.storage().instance().get(&DataKey::PlatformAddr).unwrap();
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        let total_escrow = project.amount + project.guarantee;
        let commission = total_escrow * 7 / 100;
        let payout = total_escrow - commission;

        token_client.transfer(&env.current_contract_address(), &platform, &commission);

        if favor_freelancer {
            token_client.transfer(&env.current_contract_address(), &project.freelancer, &payout);
            Self::update_reputation(&env, &project.freelancer, &project.category, 5);
            project.status = ProjectStatus::Completed;
        } else {
            token_client.transfer(&env.current_contract_address(), &project.recruiter, &payout);
            project.status = ProjectStatus::Cancelled;
        }

        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    // ── Timeouts ──────────────────────────────────────────────────────────────

    /// Auto-aprueba el proyecto si el reclutador no revisó antes del deadline.
    /// El pago va directo a la wallet custodial del freelancer.
    pub fn timeout_approve(env: Env, project_id: u64) {
        let mut project: ProjectData = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap();

        if project.status != ProjectStatus::Delivered {
            panic!("project must be in Delivered status for timeout_approve");
        }

        let now = env.ledger().timestamp();
        if now <= project.deadline {
            panic!("deadline has not passed yet");
        }

        let platform: Address = env.storage().instance().get(&DataKey::PlatformAddr).unwrap();
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        let total_escrow = project.amount + project.guarantee;
        let commission = total_escrow * 7 / 100;
        let payout = total_escrow - commission;

        token_client.transfer(&env.current_contract_address(), &platform, &commission);
        token_client.transfer(&env.current_contract_address(), &project.freelancer, &payout);

        Self::update_reputation(&env, &project.freelancer, &project.category, 5);

        project.status = ProjectStatus::Completed;
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    /// Devuelve los fondos al reclutador si el freelancer nunca aceptó
    /// o nunca re-entregó tras una corrección.
    pub fn timeout_refund(env: Env, project_id: u64) {
        let mut project: ProjectData = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap();

        if project.status != ProjectStatus::Created && project.status != ProjectStatus::Correcting {
            panic!("project must be in Created or Correcting status for timeout_refund");
        }

        let now = env.ledger().timestamp();
        if now <= project.deadline {
            panic!("deadline has not passed yet");
        }

        let platform: Address = env.storage().instance().get(&DataKey::PlatformAddr).unwrap();
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        let total_escrow = project.amount + project.guarantee;
        let commission = total_escrow * 7 / 100;
        let payout = total_escrow - commission;

        token_client.transfer(&env.current_contract_address(), &platform, &commission);
        // La devolución va a la wallet custodial del reclutador
        token_client.transfer(&env.current_contract_address(), &project.recruiter, &payout);

        project.status = ProjectStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Project(project_id), &project);
    }

    // ── Consultas ─────────────────────────────────────────────────────────────

    pub fn get_project(env: Env, project_id: u64) -> ProjectData {
        env.storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap()
    }
}

mod test;