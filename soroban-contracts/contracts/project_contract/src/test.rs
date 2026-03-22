#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, Symbol,
};

use crate::{ProjectContract, ProjectContractClient, ProjectStatus};

// ─── Constantes de tiempo ─────────────────────────────────────────────────────

const T_NOW: u64 = 1_000_000;
const ONE_DAY: u64 = 24 * 60 * 60;
const T_DEADLINE: u64 = T_NOW + ONE_DAY + 1_000; // deadline válido (> 1 día)
const T_AFTER_DEADLINE: u64 = T_DEADLINE + 1;
const T_BEFORE_MIN_DEADLINE: u64 = T_NOW + ONE_DAY - 1; // deadline demasiado cercano

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Inicializa el entorno, token y contrato. Retorna (env, client, token, reputation, admin, platform).
fn setup() -> (Env, ProjectContractClient<'static>, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().set(LedgerInfo {
        timestamp: T_NOW,
        protocol_version: 21,
        sequence_number: 1,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 4096,
        max_entry_ttl: 6312000,
    });

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let token_addr = token_contract.address();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let reputation = Address::generate(&env); // stub para unit tests

    let contract_id = env.register_contract(None, ProjectContract);
    let client = ProjectContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token_addr, &reputation, &platform);

    (env, client, token_addr, reputation, admin, platform)
}

/// Acuña tokens a un address.
fn mint(env: &Env, token: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token).mint(to, &amount);
}

/// Avanza el ledger al timestamp indicado.
fn advance_time(env: &Env, timestamp: u64) {
    env.ledger().set(LedgerInfo {
        timestamp,
        protocol_version: 21,
        sequence_number: 1,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 4096,
        max_entry_ttl: 6312000,
    });
}

/// Hash de entregable ficticio.
fn dummy_hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

/// Crea un proyecto estándar (amount=1_000_000, guarantee=200_000).
/// Fondea al reclutador con amount+guarantee y retorna project_id.
fn create_default_project(
    env: &Env,
    client: &ProjectContractClient,
    token: &Address,
    recruiter: &Address,
    freelancer: &Address,
) -> u64 {
    mint(env, token, recruiter, 1_200_000); // amount + guarantee
    client.create_project(
        recruiter,
        freelancer,
        &1_000_000i128,
        &200_000i128,
        &T_DEADLINE,
        &Symbol::new(env, "design"),
    )
}

/// Lleva un proyecto hasta estado Active.
fn project_to_active(
    env: &Env,
    client: &ProjectContractClient,
    token: &Address,
    recruiter: &Address,
    freelancer: &Address,
) -> u64 {
    let id = create_default_project(env, client, token, recruiter, freelancer);
    client.accept_project(&id, freelancer);
    id
}

/// Lleva un proyecto hasta estado Delivered.
fn project_to_delivered(
    env: &Env,
    client: &ProjectContractClient,
    token: &Address,
    recruiter: &Address,
    freelancer: &Address,
) -> u64 {
    let id = project_to_active(env, client, token, recruiter, freelancer);
    client.submit_delivery(&id, freelancer, &dummy_hash(env, 0xAB));
    id
}

/// Lleva un proyecto hasta estado Disputed.
fn project_to_disputed(
    env: &Env,
    client: &ProjectContractClient,
    token: &Address,
    recruiter: &Address,
    freelancer: &Address,
) -> u64 {
    let id = project_to_delivered(env, client, token, recruiter, freelancer);
    client.reject_delivery(&id, recruiter);
    id
}

// Helpers de cálculo de distribución (7% comisión)
const AMOUNT: i128 = 1_000_000;
const GUARANTEE: i128 = 200_000;
const TOTAL_ESCROW: i128 = AMOUNT + GUARANTEE; // 1_200_000
const COMMISSION: i128 = TOTAL_ESCROW * 7 / 100; // 84_000
const PAYOUT: i128 = TOTAL_ESCROW - COMMISSION; // 1_116_000

// ─── initialize ──────────────────────────────────────────────────────────────

#[test]
fn test_initialize_allows_project_creation() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    mint(&env, &token, &recruiter, 1_200_000);

    let id = client.create_project(
        &recruiter,
        &freelancer,
        &1_000_000i128,
        &200_000i128,
        &T_DEADLINE,
        &Symbol::new(&env, "design"),
    );
    assert_eq!(id, 1);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_initialize_twice_panics() {
    let (env, client, token, reputation, admin, platform) = setup();
    client.initialize(&admin, &token, &reputation, &platform);
}

// ─── create_project ──────────────────────────────────────────────────────────

#[test]
fn test_create_project_returns_incremental_ids() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    mint(&env, &token, &recruiter, 3_600_000);

    let id1 = client.create_project(&recruiter, &freelancer, &1_000_000i128, &200_000i128, &T_DEADLINE, &Symbol::new(&env, "design"));
    let id2 = client.create_project(&recruiter, &freelancer, &1_000_000i128, &200_000i128, &T_DEADLINE, &Symbol::new(&env, "design"));
    let id3 = client.create_project(&recruiter, &freelancer, &1_000_000i128, &200_000i128, &T_DEADLINE, &Symbol::new(&env, "design"));

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);
}

#[test]
fn test_create_project_initial_status_is_created() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Created);
}

#[test]
fn test_create_project_stores_correct_metadata() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);

    let project = client.get_project(&id);
    assert_eq!(project.recruiter, recruiter);
    assert_eq!(project.freelancer, freelancer);
    assert_eq!(project.amount, AMOUNT);
    assert_eq!(project.guarantee, GUARANTEE);
    assert_eq!(project.deadline, T_DEADLINE);
    assert_eq!(project.correction_count, 0);
}

#[test]
fn test_create_project_transfers_escrow() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    mint(&env, &token, &recruiter, TOTAL_ESCROW);

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&recruiter);

    client.create_project(&recruiter, &freelancer, &AMOUNT, &GUARANTEE, &T_DEADLINE, &Symbol::new(&env, "design"));

    assert_eq!(before - token_client.balance(&recruiter), TOTAL_ESCROW);
}

#[test]
fn test_create_project_zero_guarantee_allowed() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    mint(&env, &token, &recruiter, 500_000);

    let id = client.create_project(&recruiter, &freelancer, &500_000i128, &0i128, &T_DEADLINE, &Symbol::new(&env, "design"));
    assert_eq!(client.get_project(&id).guarantee, 0);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_create_project_zero_amount_panics() {
    let (env, client, _, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    client.create_project(&recruiter, &freelancer, &0i128, &0i128, &T_DEADLINE, &Symbol::new(&env, "design"));
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_create_project_negative_amount_panics() {
    let (env, client, _, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    client.create_project(&recruiter, &freelancer, &-1i128, &0i128, &T_DEADLINE, &Symbol::new(&env, "design"));
}

#[test]
#[should_panic(expected = "guarantee must be non-negative")]
fn test_create_project_negative_guarantee_panics() {
    let (env, client, _, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    client.create_project(&recruiter, &freelancer, &1_000i128, &-1i128, &T_DEADLINE, &Symbol::new(&env, "design"));
}

#[test]
#[should_panic(expected = "deadline must be at least 1 day from now")]
fn test_create_project_deadline_too_soon_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    mint(&env, &token, &recruiter, 1_000);
    client.create_project(&recruiter, &freelancer, &1_000i128, &0i128, &T_BEFORE_MIN_DEADLINE, &Symbol::new(&env, "design"));
}

#[test]
#[should_panic(expected = "deadline must be at least 1 day from now")]
fn test_create_project_deadline_in_past_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    mint(&env, &token, &recruiter, 1_000);
    client.create_project(&recruiter, &freelancer, &1_000i128, &0i128, &(T_NOW - 1), &Symbol::new(&env, "design"));
}

// ─── accept_project ──────────────────────────────────────────────────────────

#[test]
fn test_accept_project_status_becomes_active() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);

    client.accept_project(&id, &freelancer);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Active);
}

#[test]
#[should_panic(expected = "only the assigned freelancer can accept")]
fn test_accept_project_wrong_freelancer_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let impostor  = Address::generate(&env);
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);

    client.accept_project(&id, &impostor);
}

#[test]
#[should_panic(expected = "project is not in Created status")]
fn test_accept_project_already_active_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_active(&env, &client, &token, &recruiter, &freelancer);

    client.accept_project(&id, &freelancer);
}

#[test]
#[should_panic(expected = "project is not in Created status")]
fn test_accept_project_after_completion_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.approve_delivery(&id, &recruiter);
    client.accept_project(&id, &freelancer);
}

// ─── submit_delivery ─────────────────────────────────────────────────────────

#[test]
fn test_submit_delivery_from_active_stores_hash() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_active(&env, &client, &token, &recruiter, &freelancer);

    let hash = dummy_hash(&env, 0xCC);
    client.submit_delivery(&id, &freelancer, &hash);

    let project = client.get_project(&id);
    assert_eq!(project.delivery_hash, hash);
    assert_eq!(project.status, ProjectStatus::Delivered);
}

#[test]
fn test_submit_delivery_from_correcting_stores_hash() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.request_correction(&id, &recruiter);

    let hash2 = dummy_hash(&env, 0xDD);
    client.submit_delivery(&id, &freelancer, &hash2);

    let project = client.get_project(&id);
    assert_eq!(project.delivery_hash, hash2);
    assert_eq!(project.status, ProjectStatus::Delivered);
}

#[test]
#[should_panic(expected = "only the assigned freelancer can submit")]
fn test_submit_delivery_wrong_freelancer_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let impostor  = Address::generate(&env);
    let id = project_to_active(&env, &client, &token, &recruiter, &freelancer);

    client.submit_delivery(&id, &impostor, &dummy_hash(&env, 0x01));
}

#[test]
#[should_panic(expected = "project must be Active or Correcting to submit delivery")]
fn test_submit_delivery_on_created_status_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);

    client.submit_delivery(&id, &freelancer, &dummy_hash(&env, 0x01));
}

#[test]
#[should_panic(expected = "project must be Active or Correcting to submit delivery")]
fn test_submit_delivery_on_completed_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.approve_delivery(&id, &recruiter);
    client.submit_delivery(&id, &freelancer, &dummy_hash(&env, 0xFF));
}

// ─── approve_delivery ─────────────────────────────────────────────────────────

#[test]
fn test_approve_delivery_status_becomes_completed() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.approve_delivery(&id, &recruiter);
    assert_eq!(client.get_project(&id).status, ProjectStatus::Completed);
}

#[test]
fn test_approve_delivery_freelancer_receives_payout() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&freelancer);

    client.approve_delivery(&id, &recruiter);

    assert_eq!(token_client.balance(&freelancer) - before, PAYOUT);
}

#[test]
fn test_approve_delivery_platform_receives_commission() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&platform);

    client.approve_delivery(&id, &recruiter);

    assert_eq!(token_client.balance(&platform) - before, COMMISSION);
}

#[test]
fn test_approve_delivery_total_distribution_equals_escrow() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let freelancer_before = token_client.balance(&freelancer);
    let platform_before   = token_client.balance(&platform);

    client.approve_delivery(&id, &recruiter);

    let freelancer_received = token_client.balance(&freelancer) - freelancer_before;
    let platform_received   = token_client.balance(&platform)   - platform_before;

    assert_eq!(freelancer_received + platform_received, TOTAL_ESCROW);
}

#[test]
#[should_panic(expected = "only the recruiter can approve")]
fn test_approve_delivery_wrong_recruiter_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let impostor   = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.approve_delivery(&id, &impostor);
}

#[test]
#[should_panic(expected = "project must be in Delivered status")]
fn test_approve_delivery_on_active_status_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_active(&env, &client, &token, &recruiter, &freelancer);

    client.approve_delivery(&id, &recruiter);
}

#[test]
#[should_panic(expected = "project must be in Delivered status")]
fn test_approve_delivery_twice_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.approve_delivery(&id, &recruiter);
    client.approve_delivery(&id, &recruiter);
}

// ─── request_correction ──────────────────────────────────────────────────────

#[test]
fn test_request_correction_first_round() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.request_correction(&id, &recruiter);

    let project = client.get_project(&id);
    assert_eq!(project.status, ProjectStatus::Correcting);
    assert_eq!(project.correction_count, 1);
}

#[test]
fn test_request_correction_second_round() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.request_correction(&id, &recruiter);
    client.submit_delivery(&id, &freelancer, &dummy_hash(&env, 0x02));
    client.request_correction(&id, &recruiter);

    let project = client.get_project(&id);
    assert_eq!(project.status, ProjectStatus::Correcting);
    assert_eq!(project.correction_count, 2);
}

#[test]
#[should_panic(expected = "maximum correction rounds reached")]
fn test_request_correction_third_round_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    // Ronda 1
    client.request_correction(&id, &recruiter);
    client.submit_delivery(&id, &freelancer, &dummy_hash(&env, 0x02));
    // Ronda 2
    client.request_correction(&id, &recruiter);
    client.submit_delivery(&id, &freelancer, &dummy_hash(&env, 0x03));
    // Ronda 3 → panic
    client.request_correction(&id, &recruiter);
}

#[test]
#[should_panic(expected = "only the recruiter can request corrections")]
fn test_request_correction_wrong_recruiter_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let impostor   = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.request_correction(&id, &impostor);
}

#[test]
#[should_panic(expected = "project must be in Delivered status")]
fn test_request_correction_on_active_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_active(&env, &client, &token, &recruiter, &freelancer);

    client.request_correction(&id, &recruiter);
}

// ─── reject_delivery ─────────────────────────────────────────────────────────

#[test]
fn test_reject_delivery_status_becomes_disputed() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.reject_delivery(&id, &recruiter);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Disputed);
}

#[test]
#[should_panic(expected = "only the recruiter can reject")]
fn test_reject_delivery_wrong_recruiter_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let impostor   = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.reject_delivery(&id, &impostor);
}

#[test]
#[should_panic(expected = "project must be in Delivered status")]
fn test_reject_delivery_on_active_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_active(&env, &client, &token, &recruiter, &freelancer);

    client.reject_delivery(&id, &recruiter);
}

#[test]
#[should_panic(expected = "project must be in Delivered status")]
fn test_reject_delivery_on_disputed_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_disputed(&env, &client, &token, &recruiter, &freelancer);

    client.reject_delivery(&id, &recruiter);
}

// ─── resolve_dispute ─────────────────────────────────────────────────────────

#[test]
fn test_resolve_dispute_favor_freelancer_status_completed() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let (_, admin, _) = ((), {
        env.storage().instance().get::<_, Address>(&crate::DataKey::Admin)
            .unwrap_or_else(|| Address::generate(&env))
    }, ());

    // Recuperar admin desde el entorno
    let admin: Address = {
        let contract_id = client.address.clone();
        env.as_contract(&contract_id, || {
            env.storage().instance().get::<_, Address>(&crate::DataKey::Admin).unwrap()
        })
    };

    let id = project_to_disputed(&env, &client, &token, &recruiter, &freelancer);
    client.resolve_dispute(&id, &admin, &true);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Completed);
}

#[test]
fn test_resolve_dispute_favor_freelancer_pays_freelancer() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_disputed(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&freelancer);

    let admin: Address = env.as_contract(&client.address, || {
        env.storage().instance().get::<_, Address>(&crate::DataKey::Admin).unwrap()
    });
    client.resolve_dispute(&id, &admin, &true);

    assert_eq!(token_client.balance(&freelancer) - before, PAYOUT);
}

#[test]
fn test_resolve_dispute_favor_recruiter_status_cancelled() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_disputed(&env, &client, &token, &recruiter, &freelancer);

    let admin: Address = env.as_contract(&client.address, || {
        env.storage().instance().get::<_, Address>(&crate::DataKey::Admin).unwrap()
    });
    client.resolve_dispute(&id, &admin, &false);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Cancelled);
}

#[test]
fn test_resolve_dispute_favor_recruiter_refunds_recruiter() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_disputed(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&recruiter);

    let admin: Address = env.as_contract(&client.address, || {
        env.storage().instance().get::<_, Address>(&crate::DataKey::Admin).unwrap()
    });
    client.resolve_dispute(&id, &admin, &false);

    assert_eq!(token_client.balance(&recruiter) - before, PAYOUT);
}

#[test]
fn test_resolve_dispute_always_charges_commission() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_disputed(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let platform_before = token_client.balance(&platform);

    let admin: Address = env.as_contract(&client.address, || {
        env.storage().instance().get::<_, Address>(&crate::DataKey::Admin).unwrap()
    });
    client.resolve_dispute(&id, &admin, &true); // favor freelancer

    // La comisión se cobra sin importar a quién favorezca la disputa
    assert_eq!(token_client.balance(&platform) - platform_before, COMMISSION);
}

#[test]
fn test_resolve_dispute_total_distribution_equals_escrow() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_disputed(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let freelancer_before = token_client.balance(&freelancer);
    let platform_before   = token_client.balance(&platform);

    let admin: Address = env.as_contract(&client.address, || {
        env.storage().instance().get::<_, Address>(&crate::DataKey::Admin).unwrap()
    });
    client.resolve_dispute(&id, &admin, &true);

    let received = (token_client.balance(&freelancer) - freelancer_before)
        + (token_client.balance(&platform) - platform_before);
    assert_eq!(received, TOTAL_ESCROW);
}

#[test]
#[should_panic(expected = "only admin can resolve disputes")]
fn test_resolve_dispute_non_admin_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let impostor   = Address::generate(&env);
    let id = project_to_disputed(&env, &client, &token, &recruiter, &freelancer);

    client.resolve_dispute(&id, &impostor, &true);
}

#[test]
#[should_panic(expected = "project must be in Disputed status")]
fn test_resolve_dispute_on_active_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_active(&env, &client, &token, &recruiter, &freelancer);

    let admin: Address = env.as_contract(&client.address, || {
        env.storage().instance().get::<_, Address>(&crate::DataKey::Admin).unwrap()
    });
    client.resolve_dispute(&id, &admin, &true);
}

#[test]
#[should_panic(expected = "project must be in Disputed status")]
fn test_resolve_dispute_twice_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_disputed(&env, &client, &token, &recruiter, &freelancer);

    let admin: Address = env.as_contract(&client.address, || {
        env.storage().instance().get::<_, Address>(&crate::DataKey::Admin).unwrap()
    });
    client.resolve_dispute(&id, &admin, &true);
    client.resolve_dispute(&id, &admin, &false);
}

// ─── timeout_approve ─────────────────────────────────────────────────────────

#[test]
fn test_timeout_approve_status_becomes_completed() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_approve(&id);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Completed);
}

#[test]
fn test_timeout_approve_freelancer_receives_payout() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&freelancer);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_approve(&id);

    assert_eq!(token_client.balance(&freelancer) - before, PAYOUT);
}

#[test]
fn test_timeout_approve_platform_receives_commission() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&platform);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_approve(&id);

    assert_eq!(token_client.balance(&platform) - before, COMMISSION);
}

#[test]
fn test_timeout_approve_can_be_called_by_anyone() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    advance_time(&env, T_AFTER_DEADLINE);
    // mock_all_auths activo — cualquier account puede disparar el timeout
    client.timeout_approve(&id);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Completed);
}

#[test]
#[should_panic(expected = "deadline has not passed yet")]
fn test_timeout_approve_before_deadline_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    // Tiempo actual < deadline
    client.timeout_approve(&id);
}

#[test]
#[should_panic(expected = "project must be in Delivered status for timeout_approve")]
fn test_timeout_approve_on_active_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_active(&env, &client, &token, &recruiter, &freelancer);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_approve(&id);
}

#[test]
#[should_panic(expected = "project must be in Delivered status for timeout_approve")]
fn test_timeout_approve_twice_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_approve(&id);
    client.timeout_approve(&id);
}

// ─── timeout_refund ──────────────────────────────────────────────────────────

#[test]
fn test_timeout_refund_from_created_status_cancelled() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_refund(&id);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Cancelled);
}

#[test]
fn test_timeout_refund_from_correcting_status_cancelled() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    client.request_correction(&id, &recruiter);
    // Estado ahora es Correcting

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_refund(&id);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Cancelled);
}

#[test]
fn test_timeout_refund_recruiter_receives_payout() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&recruiter);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_refund(&id);

    assert_eq!(token_client.balance(&recruiter) - before, PAYOUT);
}

#[test]
fn test_timeout_refund_platform_receives_commission() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&platform);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_refund(&id);

    assert_eq!(token_client.balance(&platform) - before, COMMISSION);
}

#[test]
fn test_timeout_refund_total_distribution_equals_escrow() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);

    let token_client = TokenClient::new(&env, &token);
    let recruiter_before = token_client.balance(&recruiter);
    let platform_before  = token_client.balance(&platform);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_refund(&id);

    let received = (token_client.balance(&recruiter) - recruiter_before)
        + (token_client.balance(&platform) - platform_before);
    assert_eq!(received, TOTAL_ESCROW);
}

#[test]
#[should_panic(expected = "deadline has not passed yet")]
fn test_timeout_refund_before_deadline_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);

    client.timeout_refund(&id);
}

#[test]
#[should_panic(expected = "project must be in Created or Correcting status for timeout_refund")]
fn test_timeout_refund_on_active_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_active(&env, &client, &token, &recruiter, &freelancer);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_refund(&id);
}

#[test]
#[should_panic(expected = "project must be in Created or Correcting status for timeout_refund")]
fn test_timeout_refund_on_delivered_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_refund(&id);
}

#[test]
#[should_panic(expected = "project must be in Created or Correcting status for timeout_refund")]
fn test_timeout_refund_twice_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_refund(&id);
    client.timeout_refund(&id);
}

// ─── get_project ─────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_get_project_nonexistent_panics() {
    let (env, client, _, _, _, _) = setup();
    client.get_project(&9999u64);
}

#[test]
fn test_get_project_reflects_full_state() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);
    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);

    let project = client.get_project(&id);
    assert_eq!(project.status, ProjectStatus::Delivered);
    assert_eq!(project.delivery_hash, dummy_hash(&env, 0xAB));
    assert_eq!(project.correction_count, 0);
}

// ─── Flujos combinados ────────────────────────────────────────────────────────

#[test]
fn test_full_lifecycle_happy_path() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let token_client = TokenClient::new(&env, &token);

    // 1. Crear proyecto
    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);
    assert_eq!(client.get_project(&id).status, ProjectStatus::Created);

    // 2. Freelancer acepta
    client.accept_project(&id, &freelancer);
    assert_eq!(client.get_project(&id).status, ProjectStatus::Active);

    // 3. Freelancer entrega
    client.submit_delivery(&id, &freelancer, &dummy_hash(&env, 0x01));
    assert_eq!(client.get_project(&id).status, ProjectStatus::Delivered);

    // 4. Reclutador aprueba
    let fl_before = token_client.balance(&freelancer);
    let pl_before = token_client.balance(&platform);
    client.approve_delivery(&id, &recruiter);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Completed);
    assert_eq!(token_client.balance(&freelancer) - fl_before, PAYOUT);
    assert_eq!(token_client.balance(&platform) - pl_before, COMMISSION);
}

#[test]
fn test_full_lifecycle_with_two_correction_rounds() {
    let (env, client, token, _, recruiter, _) = setup();
    let freelancer = Address::generate(&env);

    let id = project_to_active(&env, &client, &token, &recruiter, &freelancer);

    // Entrega 1 → corrección 1
    client.submit_delivery(&id, &freelancer, &dummy_hash(&env, 0x01));
    client.request_correction(&id, &recruiter);
    assert_eq!(client.get_project(&id).correction_count, 1);

    // Entrega 2 → corrección 2
    client.submit_delivery(&id, &freelancer, &dummy_hash(&env, 0x02));
    client.request_correction(&id, &recruiter);
    assert_eq!(client.get_project(&id).correction_count, 2);

    // Entrega 3 → aprobación
    client.submit_delivery(&id, &freelancer, &dummy_hash(&env, 0x03));
    client.approve_delivery(&id, &recruiter);
    assert_eq!(client.get_project(&id).status, ProjectStatus::Completed);
}

#[test]
fn test_full_lifecycle_dispute_favor_freelancer() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let token_client = TokenClient::new(&env, &token);

    let id = project_to_disputed(&env, &client, &token, &recruiter, &freelancer);

    let fl_before = token_client.balance(&freelancer);
    let pl_before = token_client.balance(&platform);

    let admin: Address = env.as_contract(&client.address, || {
        env.storage().instance().get::<_, Address>(&crate::DataKey::Admin).unwrap()
    });
    client.resolve_dispute(&id, &admin, &true);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Completed);
    assert_eq!(token_client.balance(&freelancer) - fl_before, PAYOUT);
    assert_eq!(token_client.balance(&platform) - pl_before, COMMISSION);
}

#[test]
fn test_full_lifecycle_dispute_favor_recruiter() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let token_client = TokenClient::new(&env, &token);

    let id = project_to_disputed(&env, &client, &token, &recruiter, &freelancer);

    let rec_before = token_client.balance(&recruiter);
    let pl_before  = token_client.balance(&platform);

    let admin: Address = env.as_contract(&client.address, || {
        env.storage().instance().get::<_, Address>(&crate::DataKey::Admin).unwrap()
    });
    client.resolve_dispute(&id, &admin, &false);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Cancelled);
    assert_eq!(token_client.balance(&recruiter) - rec_before, PAYOUT);
    assert_eq!(token_client.balance(&platform)  - pl_before,  COMMISSION);
}

#[test]
fn test_full_lifecycle_timeout_not_accepted() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let token_client = TokenClient::new(&env, &token);

    let id = create_default_project(&env, &client, &token, &recruiter, &freelancer);
    // Freelancer nunca acepta

    let rec_before = token_client.balance(&recruiter);
    let pl_before  = token_client.balance(&platform);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_refund(&id);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Cancelled);
    assert_eq!(token_client.balance(&recruiter) - rec_before, PAYOUT);
    assert_eq!(token_client.balance(&platform)  - pl_before,  COMMISSION);
}

#[test]
fn test_full_lifecycle_timeout_delivered_not_reviewed() {
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let token_client = TokenClient::new(&env, &token);

    let id = project_to_delivered(&env, &client, &token, &recruiter, &freelancer);
    // Reclutador nunca revisa

    let fl_before = token_client.balance(&freelancer);
    let pl_before = token_client.balance(&platform);

    advance_time(&env, T_AFTER_DEADLINE);
    client.timeout_approve(&id);

    assert_eq!(client.get_project(&id).status, ProjectStatus::Completed);
    assert_eq!(token_client.balance(&freelancer) - fl_before, PAYOUT);
    assert_eq!(token_client.balance(&platform) - pl_before, COMMISSION);
}

#[test]
fn test_two_projects_are_independent() {
    let (env, client, token, _, recruiter, _) = setup();
    let fl1 = Address::generate(&env);
    let fl2 = Address::generate(&env);

    let id1 = create_default_project(&env, &client, &token, &recruiter, &fl1);
    let id2 = create_default_project(&env, &client, &token, &recruiter, &fl2);

    client.accept_project(&id1, &fl1);

    // id1 avanzó a Active, id2 sigue en Created
    assert_eq!(client.get_project(&id1).status, ProjectStatus::Active);
    assert_eq!(client.get_project(&id2).status, ProjectStatus::Created);
}

#[test]
fn test_commission_math_no_guarantee() {
    // amount=1_000_000, guarantee=0 → total=1_000_000, comisión 7%=70_000, payout=930_000
    let (env, client, token, _, recruiter, platform) = setup();
    let freelancer = Address::generate(&env);
    let token_client = TokenClient::new(&env, &token);

    mint(&env, &token, &recruiter, 1_000_000);
    let id = client.create_project(
        &recruiter,
        &freelancer,
        &1_000_000i128,
        &0i128,
        &T_DEADLINE,
        &Symbol::new(&env, "design"),
    );

    client.accept_project(&id, &freelancer);
    client.submit_delivery(&id, &freelancer, &dummy_hash(&env, 0x01));

    let fl_before = token_client.balance(&freelancer);
    let pl_before = token_client.balance(&platform);

    client.approve_delivery(&id, &recruiter);

    assert_eq!(token_client.balance(&freelancer) - fl_before, 930_000);
    assert_eq!(token_client.balance(&platform)   - pl_before,  70_000);
}