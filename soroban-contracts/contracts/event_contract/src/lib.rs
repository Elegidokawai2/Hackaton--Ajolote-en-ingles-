#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, BytesN, Env, IntoVal, Map, Symbol, Vec,
};

// ─── Data types ──────────────────────────────────────────────────────────────

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum EventStatus {
    Open,
    Closed,
    Resolved,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct EventData {
    pub recruiter: Address,
    pub prize: i128,
    pub category: Symbol,
    pub deadline_submit: u64,
    pub deadline_select: u64,
    pub status: EventStatus,
    pub applicants: Vec<Address>,
    pub submissions: Map<Address, BytesN<32>>,
}

// ─── Storage keys ────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    ReputationAddr,
    WalletRegistryAddr,  // Address del contrato WalletRegistry
    Event(u64),
    Counter,
    PlatformAddr,
}

// ─── Contrato ────────────────────────────────────────────────────────────────

#[contract]
pub struct EventContract;

#[contractimpl]
impl EventContract {

    // ── Inicialización ────────────────────────────────────────────────────────

    /// Configura admin, token, contrato de reputación, plataforma y WalletRegistry.
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
    /// Se llama en create_event (reclutador) y apply_to_event (freelancer).
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

    /// Verifica que una wallet tenga el rol esperado en WalletRegistry.
    /// Evita que un freelancer cree eventos o que un reclutador aplique como participante.
    fn require_role(env: &Env, wallet: &Address, expected_role_tag: &str) {
        let registry_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::WalletRegistryAddr)
            .unwrap();

        // get_role_by_wallet retorna un ScVal enum — comparamos el tag como Symbol
        let role_val: Symbol = env.invoke_contract(
            &registry_addr,
            &Symbol::new(env, "get_role_by_wallet"),
            (wallet.clone(),).into_val(env),
        );

        if role_val != Symbol::new(env, expected_role_tag) {
            panic!("wallet does not have the required role for this operation");
        }
    }

    // ── Creación de eventos ───────────────────────────────────────────────────

    /// Crea un nuevo evento. El reclutador debe estar registrado y activo,
    /// y debe tener rol Recruiter en WalletRegistry.
    pub fn create_event(
        env: Env,
        recruiter: Address,
        prize: i128,
        category: Symbol,
        deadline_submit: u64,
        deadline_select: u64,
    ) -> u64 {
        recruiter.require_auth();

        // Validar que el reclutador sea un usuario activo registrado con rol correcto
        Self::require_active_wallet(&env, &recruiter);
        Self::require_role(&env, &recruiter, "Recruiter");

        if prize <= 0 {
            panic!("prize must be positive");
        }
        if deadline_submit >= deadline_select {
            panic!("deadline_submit must be before deadline_select");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&recruiter, &env.current_contract_address(), &prize);

        let mut counter: u64 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        counter += 1;
        env.storage().instance().set(&DataKey::Counter, &counter);

        let event = EventData {
            recruiter,
            prize,
            category,
            deadline_submit,
            deadline_select,
            status: EventStatus::Open,
            applicants: Vec::new(&env),
            submissions: Map::new(&env),
        };
        env.storage().persistent().set(&DataKey::Event(counter), &event);

        counter
    }

    // ── Aplicación a eventos ──────────────────────────────────────────────────

    /// Un freelancer aplica para participar. Debe estar registrado y activo,
    /// y debe tener rol Freelancer en WalletRegistry.
    pub fn apply_to_event(env: Env, event_id: u64, freelancer: Address) {
        freelancer.require_auth();

        // Validar que el freelancer sea un usuario activo con rol correcto
        Self::require_active_wallet(&env, &freelancer);
        Self::require_role(&env, &freelancer, "Freelancer");

        let mut event: EventData = env
            .storage()
            .persistent()
            .get(&DataKey::Event(event_id))
            .unwrap();

        if event.status != EventStatus::Open {
            panic!("event is not open");
        }

        let now = env.ledger().timestamp();
        if now > event.deadline_submit {
            panic!("submission deadline has passed");
        }

        for i in 0..event.applicants.len() {
            if event.applicants.get(i).unwrap() == freelancer {
                panic!("already applied");
            }
        }

        event.applicants.push_back(freelancer);
        env.storage().persistent().set(&DataKey::Event(event_id), &event);
    }

    // ── Envío de entregables ──────────────────────────────────────────────────

    /// Un freelancer envía su entregable. No requiere validación de WalletRegistry
    /// porque ya fue validado en apply_to_event y la presencia en applicants es suficiente.
    pub fn submit_entry(env: Env, event_id: u64, freelancer: Address, entry_hash: BytesN<32>) {
        freelancer.require_auth();

        let mut event: EventData = env
            .storage()
            .persistent()
            .get(&DataKey::Event(event_id))
            .unwrap();

        if event.status != EventStatus::Open {
            panic!("event is not open");
        }

        let now = env.ledger().timestamp();
        if now > event.deadline_submit {
            panic!("submission deadline has passed");
        }

        let mut found = false;
        for i in 0..event.applicants.len() {
            if event.applicants.get(i).unwrap() == freelancer {
                found = true;
                break;
            }
        }
        if !found {
            panic!("freelancer has not applied to this event");
        }

        event.submissions.set(freelancer, entry_hash);
        env.storage().persistent().set(&DataKey::Event(event_id), &event);
    }

    // ── Selección de ganadores ────────────────────────────────────────────────

    /// El reclutador selecciona ganadores y distribuye el premio.
    /// Los pagos van directamente a las wallets custodiales de los ganadores.
    pub fn select_winners(env: Env, event_id: u64, winners: Vec<Address>) {
        let mut event: EventData = env
            .storage()
            .persistent()
            .get(&DataKey::Event(event_id))
            .unwrap();

        event.recruiter.require_auth();

        if event.status != EventStatus::Open {
            panic!("event is not open");
        }

        let now = env.ledger().timestamp();
        if now < event.deadline_submit {
            panic!("cannot select winners before submission deadline");
        }
        if winners.is_empty() {
            panic!("must select at least one winner");
        }

        for i in 0..winners.len() {
            let winner = winners.get(i).unwrap();
            if !event.submissions.contains_key(winner.clone()) {
                panic!("winner has not submitted an entry");
            }
        }

        let platform: Address = env.storage().instance().get(&DataKey::PlatformAddr).unwrap();
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        let commission = event.prize / 10; // 10%
        let payout = event.prize - commission;
        let prize_per_winner = payout / (winners.len() as i128);

        token_client.transfer(&env.current_contract_address(), &platform, &commission);

        for i in 0..winners.len() {
            let winner = winners.get(i).unwrap();
            // El pago va directo a la wallet custodial del ganador
            token_client.transfer(&env.current_contract_address(), &winner, &prize_per_winner);
        }

        let reputation_addr: Address = env.storage().instance().get(&DataKey::ReputationAddr).unwrap();
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

        let rep_delta: u32 = 10;
        for i in 0..winners.len() {
            let winner = winners.get(i).unwrap();
            env.invoke_contract::<()>(
                &reputation_addr,
                &Symbol::new(&env, "add_reputation"),
                (admin.clone(), winner, event.category.clone(), rep_delta).into_val(&env),
            );
        }

        let delta_rep_no_winners: u32 = 1;
        for i in 0..event.applicants.len() {
            let applicant = event.applicants.get(i).unwrap();

            let mut is_winner = false;
            for j in 0..winners.len() {
                if applicant == winners.get(j).unwrap() {
                    is_winner = true;
                    break;
                }
            }
            if is_winner {
                continue;
            }

            env.invoke_contract::<()>(
                &reputation_addr,
                &Symbol::new(&env, "add_reputation"),
                (admin.clone(), applicant, event.category.clone(), delta_rep_no_winners).into_val(&env),
            );
        }

        event.status = EventStatus::Resolved;
        env.storage().persistent().set(&DataKey::Event(event_id), &event);
    }

    // ── Timeout ───────────────────────────────────────────────────────────────

    /// Si el reclutador no selecciona ganadores antes del deadline_select,
    /// cualquiera puede llamar esta función para devolver los fondos al reclutador.
    pub fn timeout_distribute(env: Env, event_id: u64) {
        let mut event: EventData = env
            .storage()
            .persistent()
            .get(&DataKey::Event(event_id))
            .unwrap();

        if event.status != EventStatus::Open {
            panic!("event is not open");
        }

        let now = env.ledger().timestamp();
        if now <= event.deadline_select {
            panic!("selection deadline has not passed yet");
        }

        let commission = event.prize / 10; // 10%
        let payout = event.prize - commission;

        let platform: Address = env.storage().instance().get(&DataKey::PlatformAddr).unwrap();
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        token_client.transfer(&env.current_contract_address(), &platform, &commission);
        // La devolución va a la wallet custodial del reclutador
        token_client.transfer(&env.current_contract_address(), &event.recruiter, &payout);

        event.status = EventStatus::Closed;
        env.storage().persistent().set(&DataKey::Event(event_id), &event);
    }

    // ── Consultas ─────────────────────────────────────────────────────────────

    pub fn get_event(env: Env, event_id: u64) -> EventData {
        env.storage()
            .persistent()
            .get(&DataKey::Event(event_id))
            .unwrap()
    }
}

mod test;