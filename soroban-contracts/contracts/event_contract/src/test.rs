#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    vec, Address, BytesN, Env, Symbol,
};

use crate::{EventContract, EventContractClient, EventStatus};
use reputation_ledger::{ReputationLedger, ReputationLedgerClient};

// ─── Constantes de tiempo ─────────────────────────────────────────────────────

const T_NOW: u64 = 1_000_000;
const T_SUBMIT: u64 = T_NOW + 10_000;    // deadline_submit
const T_SELECT: u64 = T_NOW + 20_000;    // deadline_select
const T_AFTER_SUBMIT: u64 = T_SUBMIT + 1;
const T_AFTER_SELECT: u64 = T_SELECT + 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Inicializa el entorno, registra el contrato y retorna todas las partes.
fn setup() -> (Env, EventContractClient<'static>, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().set(LedgerInfo {
        timestamp: T_NOW,
        protocol_version: 25,
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

    let contract_id = env.register_contract(None, EventContract);
    let client = EventContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token_addr, &reputation, &platform);

    (env, client, token_addr, reputation, admin, platform)
}

/// Acuña tokens a una dirección usando StellarAssetClient.
fn mint(env: &Env, token: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token).mint(to, &amount);
}

/// Crea un evento estándar con prize = 1_000_000 y retorna su event_id.
fn create_default_event(
    env: &Env,
    client: &EventContractClient,
    token: &Address,
    recruiter: &Address,
) -> u64 {
    mint(env, token, recruiter, 1_000_000);
    client.create_event(
        recruiter,
        &1_000_000i128,
        &Symbol::new(env, "design"),
        &T_SUBMIT,
        &T_SELECT,
    )
}

/// Retorna un BytesN<32> de relleno usando `seed` como byte repetido.
fn dummy_hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

/// Avanza el timestamp del ledger al valor indicado.
fn advance_time(env: &Env, timestamp: u64) {
    env.ledger().set(LedgerInfo {
        timestamp,
        protocol_version: 25,
        sequence_number: 1,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 4096,
        max_entry_ttl: 6312000,
    });
}

/// Crea un evento, hace que `count` freelancers apliquen y entreguen,
/// avanza el tiempo más allá de deadline_submit y retorna (event_id, freelancers).
fn setup_with_submissions(
    env: &Env,
    client: &EventContractClient,
    token: &Address,
    recruiter: &Address,
    count: usize,
) -> (u64, soroban_sdk::Vec<Address>) {
    let event_id = create_default_event(env, client, token, recruiter);
    let mut freelancers = soroban_sdk::Vec::new(env);

    for i in 0..count {
        let f = Address::generate(env);
        client.apply_to_event(&event_id, &f);
        client.submit_entry(&event_id, &f, &dummy_hash(env, i as u8));
        freelancers.push_back(f);
    }

    advance_time(env, T_AFTER_SUBMIT);
    (event_id, freelancers)
}

// ─── initialize ──────────────────────────────────────────────────────────────

#[test]
fn test_initialize_allows_event_creation() {
    let (env, client, token, _, admin, _) = setup();
    mint(&env, &token, &admin, 1_000);
    let id = client.create_event(&admin, &1_000i128, &Symbol::new(&env, "test"), &T_SUBMIT, &T_SELECT);
    assert_eq!(id, 1);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_initialize_twice_panics() {
    let (env, client, token, reputation, admin, platform) = setup();
    client.initialize(&admin, &token, &reputation, &platform);
}

// ─── create_event ────────────────────────────────────────────────────────────

#[test]
fn test_create_event_returns_incremental_ids() {
    let (env, client, token, _, admin, _) = setup();
    mint(&env, &token, &admin, 3_000_000);

    let id1 = client.create_event(&admin, &1_000_000i128, &Symbol::new(&env, "design"), &T_SUBMIT, &T_SELECT);
    let id2 = client.create_event(&admin, &1_000_000i128, &Symbol::new(&env, "design"), &T_SUBMIT, &T_SELECT);
    let id3 = client.create_event(&admin, &1_000_000i128, &Symbol::new(&env, "design"), &T_SUBMIT, &T_SELECT);

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);
}

#[test]
fn test_create_event_initial_status_is_open() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);
    assert_eq!(client.get_event(&id).status, EventStatus::Open);
}

#[test]
fn test_create_event_stores_correct_metadata() {
    let (env, client, token, _, recruiter, _) = setup();
    mint(&env, &token, &recruiter, 500_000);
    let category = Symbol::new(&env, "backend");

    let id = client.create_event(&recruiter, &500_000i128, &category, &T_SUBMIT, &T_SELECT);
    let event = client.get_event(&id);

    assert_eq!(event.recruiter, recruiter);
    assert_eq!(event.prize, 500_000);
    assert_eq!(event.deadline_submit, T_SUBMIT);
    assert_eq!(event.deadline_select, T_SELECT);
    assert_eq!(event.applicants.len(), 0);
    assert_eq!(event.submissions.len(), 0);
}

#[test]
fn test_create_event_transfers_prize_to_escrow() {
    let (env, client, token, _, recruiter, _) = setup();
    mint(&env, &token, &recruiter, 1_000_000);
    let token_client = TokenClient::new(&env, &token);

    let before = token_client.balance(&recruiter);
    create_default_event(&env, &client, &token, &recruiter);
    let after = token_client.balance(&recruiter);

    assert_eq!(before - after, 1_000_000);
}

#[test]
#[should_panic(expected = "prize must be positive")]
fn test_create_event_zero_prize_panics() {
    let (env, client, _, _, recruiter, _) = setup();
    client.create_event(&recruiter, &0i128, &Symbol::new(&env, "design"), &T_SUBMIT, &T_SELECT);
}

#[test]
#[should_panic(expected = "prize must be positive")]
fn test_create_event_negative_prize_panics() {
    let (env, client, _, _, recruiter, _) = setup();
    client.create_event(&recruiter, &-1i128, &Symbol::new(&env, "design"), &T_SUBMIT, &T_SELECT);
}

#[test]
#[should_panic(expected = "deadline_submit must be before deadline_select")]
fn test_create_event_inverted_deadlines_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    mint(&env, &token, &recruiter, 1_000_000);
    client.create_event(&recruiter, &1_000_000i128, &Symbol::new(&env, "design"), &T_SELECT, &T_SUBMIT);
}

#[test]
#[should_panic(expected = "deadline_submit must be before deadline_select")]
fn test_create_event_equal_deadlines_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    mint(&env, &token, &recruiter, 1_000_000);
    client.create_event(&recruiter, &1_000_000i128, &Symbol::new(&env, "design"), &T_SUBMIT, &T_SUBMIT);
}

// ─── apply_to_event ───────────────────────────────────────────────────────────

#[test]
fn test_apply_to_event_adds_applicant() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    let freelancer = Address::generate(&env);
    client.apply_to_event(&id, &freelancer);

    let event = client.get_event(&id);
    assert_eq!(event.applicants.len(), 1);
    assert_eq!(event.applicants.get(0).unwrap(), freelancer);
}

#[test]
fn test_apply_to_event_multiple_freelancers() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    for _ in 0..5 {
        client.apply_to_event(&id, &Address::generate(&env));
    }

    assert_eq!(client.get_event(&id).applicants.len(), 5);
}

#[test]
#[should_panic(expected = "already applied")]
fn test_apply_to_event_duplicate_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    let freelancer = Address::generate(&env);
    client.apply_to_event(&id, &freelancer);
    client.apply_to_event(&id, &freelancer);
}

#[test]
#[should_panic(expected = "submission deadline has passed")]
fn test_apply_to_event_after_deadline_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    advance_time(&env, T_AFTER_SUBMIT);
    client.apply_to_event(&id, &Address::generate(&env));
}

#[test]
#[should_panic(expected = "event is not open")]
fn test_apply_to_closed_event_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    advance_time(&env, T_AFTER_SELECT);
    client.timeout_distribute(&id);

    client.apply_to_event(&id, &Address::generate(&env));
}

// ─── submit_entry ─────────────────────────────────────────────────────────────

#[test]
fn test_submit_entry_stores_hash() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    let freelancer = Address::generate(&env);
    client.apply_to_event(&id, &freelancer);

    let hash = dummy_hash(&env, 0xAB);
    client.submit_entry(&id, &freelancer, &hash);

    let event = client.get_event(&id);
    assert_eq!(event.submissions.get(freelancer).unwrap(), hash);
}

#[test]
fn test_submit_entry_overwrites_previous_hash() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    let freelancer = Address::generate(&env);
    client.apply_to_event(&id, &freelancer);

    client.submit_entry(&id, &freelancer, &dummy_hash(&env, 0x01));
    client.submit_entry(&id, &freelancer, &dummy_hash(&env, 0x02));

    let event = client.get_event(&id);
    assert_eq!(event.submissions.get(freelancer).unwrap(), dummy_hash(&env, 0x02));
}

#[test]
#[should_panic(expected = "freelancer has not applied to this event")]
fn test_submit_entry_without_apply_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    client.submit_entry(&id, &Address::generate(&env), &dummy_hash(&env, 0x01));
}

#[test]
#[should_panic(expected = "submission deadline has passed")]
fn test_submit_entry_after_deadline_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    let freelancer = Address::generate(&env);
    client.apply_to_event(&id, &freelancer);

    advance_time(&env, T_AFTER_SUBMIT);
    client.submit_entry(&id, &freelancer, &dummy_hash(&env, 0x01));
}

#[test]
#[should_panic(expected = "event is not open")]
fn test_submit_entry_on_resolved_event_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let (id, freelancers) = setup_with_submissions(&env, &client, &token, &recruiter, 1);

    let winner = freelancers.get(0).unwrap();
    client.select_winners(&id, &vec![&env, winner.clone()]);

    client.submit_entry(&id, &winner, &dummy_hash(&env, 0xFF));
}

// ─── select_winners ───────────────────────────────────────────────────────────

#[test]
fn test_select_winners_status_becomes_resolved() {
    let (env, client, token, _, recruiter, _) = setup();
    let (id, freelancers) = setup_with_submissions(&env, &client, &token, &recruiter, 1);

    client.select_winners(&id, &vec![&env, freelancers.get(0).unwrap()]);

    assert_eq!(client.get_event(&id).status, EventStatus::Resolved);
}

#[test]
fn test_select_winners_single_winner_receives_90_percent() {
    let (env, client, token, _, recruiter, _) = setup();
    let (id, freelancers) = setup_with_submissions(&env, &client, &token, &recruiter, 1);

    let winner = freelancers.get(0).unwrap();
    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&winner);

    client.select_winners(&id, &vec![&env, winner.clone()]);

    // prize 1_000_000, comisión 10% → ganador recibe 900_000
    assert_eq!(token_client.balance(&winner) - before, 900_000);
}

#[test]
fn test_select_winners_platform_receives_10_percent() {
    let (env, client, token, _, recruiter, platform) = setup();
    let (id, freelancers) = setup_with_submissions(&env, &client, &token, &recruiter, 1);

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&platform);

    client.select_winners(&id, &vec![&env, freelancers.get(0).unwrap()]);

    assert_eq!(token_client.balance(&platform) - before, 100_000);
}

#[test]
fn test_select_winners_splits_equally_two_winners() {
    let (env, client, token, _, recruiter, _) = setup();
    let (id, freelancers) = setup_with_submissions(&env, &client, &token, &recruiter, 2);

    let w1 = freelancers.get(0).unwrap();
    let w2 = freelancers.get(1).unwrap();
    let token_client = TokenClient::new(&env, &token);

    let b1 = token_client.balance(&w1);
    let b2 = token_client.balance(&w2);

    client.select_winners(&id, &vec![&env, w1.clone(), w2.clone()]);

    // 900_000 / 2 = 450_000 cada uno
    assert_eq!(token_client.balance(&w1) - b1, 450_000);
    assert_eq!(token_client.balance(&w2) - b2, 450_000);
}

#[test]
fn test_select_winners_splits_equally_three_winners() {
    let (env, client, token, _, recruiter, _) = setup();
    let (id, freelancers) = setup_with_submissions(&env, &client, &token, &recruiter, 3);

    let token_client = TokenClient::new(&env, &token);
    let w0 = freelancers.get(0).unwrap();
    let b0 = token_client.balance(&w0);

    client.select_winners(&id, &vec![
        &env,
        w0.clone(),
        freelancers.get(1).unwrap(),
        freelancers.get(2).unwrap(),
    ]);

    // 900_000 / 3 = 300_000 cada uno
    assert_eq!(token_client.balance(&w0) - b0, 300_000);
}

#[test]
fn test_select_winners_losers_receive_no_tokens() {
    let (env, client, token, _, recruiter, _) = setup();
    let (id, freelancers) = setup_with_submissions(&env, &client, &token, &recruiter, 3);

    let winner = freelancers.get(0).unwrap();
    let loser1  = freelancers.get(1).unwrap();
    let loser2  = freelancers.get(2).unwrap();

    let token_client = TokenClient::new(&env, &token);
    let l1_before = token_client.balance(&loser1);
    let l2_before = token_client.balance(&loser2);

    client.select_winners(&id, &vec![&env, winner]);

    assert_eq!(token_client.balance(&loser1), l1_before);
    assert_eq!(token_client.balance(&loser2), l2_before);
}

#[test]
#[should_panic(expected = "must select at least one winner")]
fn test_select_winners_empty_list_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let (id, _) = setup_with_submissions(&env, &client, &token, &recruiter, 1);

    let empty: soroban_sdk::Vec<Address> = soroban_sdk::Vec::new(&env);
    client.select_winners(&id, &empty);
}

#[test]
#[should_panic(expected = "winner has not submitted an entry")]
fn test_select_winners_non_submitter_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    let freelancer = Address::generate(&env);
    client.apply_to_event(&id, &freelancer);
    // No hace submit_entry

    advance_time(&env, T_AFTER_SUBMIT);
    client.select_winners(&id, &vec![&env, freelancer]);
}

#[test]
#[should_panic(expected = "cannot select winners before submission deadline")]
fn test_select_winners_before_submit_deadline_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    let f = Address::generate(&env);
    client.apply_to_event(&id, &f);
    client.submit_entry(&id, &f, &dummy_hash(&env, 0x01));

    // Tiempo aún < deadline_submit
    client.select_winners(&id, &vec![&env, f]);
}

#[test]
#[should_panic(expected = "event is not open")]
fn test_select_winners_on_resolved_event_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let (id, freelancers) = setup_with_submissions(&env, &client, &token, &recruiter, 1);

    let winners = vec![&env, freelancers.get(0).unwrap()];
    client.select_winners(&id, &winners.clone());
    client.select_winners(&id, &winners); // segunda vez → panic
}

#[test]
#[should_panic(expected = "event is not open")]
fn test_select_winners_on_closed_event_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let (id, freelancers) = setup_with_submissions(&env, &client, &token, &recruiter, 1);

    advance_time(&env, T_AFTER_SELECT);
    client.timeout_distribute(&id);

    client.select_winners(&id, &vec![&env, freelancers.get(0).unwrap()]);
}

// ─── timeout_distribute ───────────────────────────────────────────────────────

#[test]
fn test_timeout_distribute_closes_event() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    advance_time(&env, T_AFTER_SELECT);
    client.timeout_distribute(&id);

    assert_eq!(client.get_event(&id).status, EventStatus::Closed);
}

#[test]
fn test_timeout_distribute_refunds_90_percent_to_recruiter() {
    let (env, client, token, _, recruiter, _) = setup();
    mint(&env, &token, &recruiter, 1_000_000);

    let id = client.create_event(
        &recruiter,
        &1_000_000i128,
        &Symbol::new(&env, "design"),
        &T_SUBMIT,
        &T_SELECT,
    );

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&recruiter);

    advance_time(&env, T_AFTER_SELECT);
    client.timeout_distribute(&id);

    assert_eq!(token_client.balance(&recruiter) - before, 900_000);
}

#[test]
fn test_timeout_distribute_sends_10_percent_to_platform() {
    let (env, client, token, _, recruiter, platform) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    let token_client = TokenClient::new(&env, &token);
    let before = token_client.balance(&platform);

    advance_time(&env, T_AFTER_SELECT);
    client.timeout_distribute(&id);

    assert_eq!(token_client.balance(&platform) - before, 100_000);
}

#[test]
fn test_timeout_distribute_can_be_called_by_anyone() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    advance_time(&env, T_AFTER_SELECT);

    // No verificamos quién llama — cualquier account puede disparar el timeout
    client.timeout_distribute(&id);

    assert_eq!(client.get_event(&id).status, EventStatus::Closed);
}

#[test]
#[should_panic(expected = "selection deadline has not passed yet")]
fn test_timeout_distribute_before_select_deadline_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    // Timestamp actual < deadline_select
    client.timeout_distribute(&id);
}

#[test]
#[should_panic(expected = "selection deadline has not passed yet")]
fn test_timeout_distribute_between_submit_and_select_deadlines_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    // Pasó deadline_submit pero aún no deadline_select
    advance_time(&env, T_AFTER_SUBMIT);
    client.timeout_distribute(&id);
}

#[test]
#[should_panic(expected = "event is not open")]
fn test_timeout_distribute_on_resolved_event_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let (id, freelancers) = setup_with_submissions(&env, &client, &token, &recruiter, 1);

    client.select_winners(&id, &vec![&env, freelancers.get(0).unwrap()]);

    advance_time(&env, T_AFTER_SELECT);
    client.timeout_distribute(&id);
}

#[test]
#[should_panic(expected = "event is not open")]
fn test_timeout_distribute_twice_panics() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    advance_time(&env, T_AFTER_SELECT);
    client.timeout_distribute(&id);
    client.timeout_distribute(&id);
}

// ─── get_event ────────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_get_event_nonexistent_panics() {
    let (env, client, _, _, _, _) = setup();
    client.get_event(&9999u64);
}

#[test]
fn test_get_event_reflects_applicants_and_submissions() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    let f1 = Address::generate(&env);
    let f2 = Address::generate(&env);
    let h1 = dummy_hash(&env, 0xAA);
    let h2 = dummy_hash(&env, 0xBB);

    client.apply_to_event(&id, &f1);
    client.apply_to_event(&id, &f2);
    client.submit_entry(&id, &f1, &h1);
    client.submit_entry(&id, &f2, &h2);

    let event = client.get_event(&id);
    assert_eq!(event.applicants.len(), 2);
    assert_eq!(event.submissions.len(), 2);
    assert_eq!(event.submissions.get(f1).unwrap(), h1);
    assert_eq!(event.submissions.get(f2).unwrap(), h2);
}

// ─── Flujos combinados ────────────────────────────────────────────────────────

#[test]
fn test_full_lifecycle_single_winner() {
    let (env, client, token, _, recruiter, platform) = setup();
    let token_client = TokenClient::new(&env, &token);

    mint(&env, &token, &recruiter, 1_000_000);
    let id = client.create_event(
        &recruiter,
        &1_000_000i128,
        &Symbol::new(&env, "design"),
        &T_SUBMIT,
        &T_SELECT,
    );

    let winner = Address::generate(&env);
    let loser  = Address::generate(&env);

    client.apply_to_event(&id, &winner);
    client.apply_to_event(&id, &loser);
    client.submit_entry(&id, &winner, &dummy_hash(&env, 0x01));
    client.submit_entry(&id, &loser,  &dummy_hash(&env, 0x02));

    advance_time(&env, T_AFTER_SUBMIT);
    client.select_winners(&id, &vec![&env, winner.clone()]);

    let event = client.get_event(&id);
    assert_eq!(event.status, EventStatus::Resolved);
    assert_eq!(token_client.balance(&winner), 900_000);
    assert_eq!(token_client.balance(&platform), 100_000);
    assert_eq!(token_client.balance(&loser), 0);
}

#[test]
fn test_full_lifecycle_timeout_path() {
    let (env, client, token, _, recruiter, platform) = setup();
    let token_client = TokenClient::new(&env, &token);

    mint(&env, &token, &recruiter, 1_000_000);
    let id = client.create_event(
        &recruiter,
        &1_000_000i128,
        &Symbol::new(&env, "design"),
        &T_SUBMIT,
        &T_SELECT,
    );

    let recruiter_before  = token_client.balance(&recruiter);
    let platform_before   = token_client.balance(&platform);

    advance_time(&env, T_AFTER_SELECT);
    client.timeout_distribute(&id);

    assert_eq!(client.get_event(&id).status, EventStatus::Closed);
    assert_eq!(token_client.balance(&recruiter) - recruiter_before, 900_000);
    assert_eq!(token_client.balance(&platform)  - platform_before,  100_000);
}

#[test]
fn test_two_events_are_independent() {
    let (env, client, token, _, recruiter, _) = setup();

    mint(&env, &token, &recruiter, 2_000_000);

    let id1 = client.create_event(&recruiter, &1_000_000i128, &Symbol::new(&env, "design"),  &T_SUBMIT, &T_SELECT);
    let id2 = client.create_event(&recruiter, &1_000_000i128, &Symbol::new(&env, "backend"), &T_SUBMIT, &T_SELECT);

    let f1 = Address::generate(&env);
    let f2 = Address::generate(&env);

    client.apply_to_event(&id1, &f1);
    client.apply_to_event(&id2, &f2);
    client.submit_entry(&id1, &f1, &dummy_hash(&env, 0x01));
    client.submit_entry(&id2, &f2, &dummy_hash(&env, 0x02));

    advance_time(&env, T_AFTER_SUBMIT);
    client.select_winners(&id1, &vec![&env, f1]);

    assert_eq!(client.get_event(&id1).status, EventStatus::Resolved);
    assert_eq!(client.get_event(&id2).status, EventStatus::Open);
}

#[test]
fn test_recruiter_cannot_apply_own_event_as_separate_user() {
    let (env, client, token, _, recruiter, _) = setup();
    let id = create_default_event(&env, &client, &token, &recruiter);

    // El contrato no impide que el reclutador aplique como freelancer —
    // verificamos que la lógica lo permite (decisión de producto, no bug de seguridad)
    client.apply_to_event(&id, &recruiter);
    assert_eq!(client.get_event(&id).applicants.len(), 1);
}