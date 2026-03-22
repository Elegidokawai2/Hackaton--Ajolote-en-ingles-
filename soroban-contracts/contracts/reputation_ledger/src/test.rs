#![cfg(test)]

use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
    Address, Env, IntoVal, Symbol,
};

use crate::{ReputationLedger, ReputationLedgerClient};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Registra el contrato y retorna (client, admin).
/// El admin ya está autenticado via mock_all_auths e initialize fue llamado.
fn setup(env: &Env) -> (ReputationLedgerClient, Address) {
    let contract_id = env.register_contract(None, ReputationLedger);
    let client = ReputationLedgerClient::new(env, &contract_id);
    let admin = Address::generate(env);

    env.mock_all_auths();
    client.initialize(&admin);

    (client, admin)
}

/// Categoría de prueba reutilizable.
fn cat_design(env: &Env) -> Symbol {
    Symbol::new(env, "design")
}

fn cat_backend(env: &Env) -> Symbol {
    Symbol::new(env, "backend")
}

// ─── initialize ──────────────────────────────────────────────────────────────

#[test]
fn test_initialize_sets_admin() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    assert_eq!(client.get_admin(), admin);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_initialize_twice_panics() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    // Segunda llamada debe hacer panic
    client.initialize(&admin);
}

#[test]
fn test_initialize_requires_admin_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ReputationLedger);
    let client = ReputationLedgerClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);

    // Verificar que se exigió auth del admin
    let auths = env.auths();
    assert!(auths.iter().any(|(addr, _)| *addr == admin));
}

// ─── get_admin ───────────────────────────────────────────────────────────────

#[test]
fn test_get_admin_returns_correct_address() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    assert_eq!(client.get_admin(), admin);
}

// ─── authorize_contract ──────────────────────────────────────────────────────

#[test]
fn test_authorize_contract_succeeds_as_admin() {
    let env = Env::default();
    let (client, _admin) = setup(&env);

    let external_contract = Address::generate(&env);

    // No debe hacer panic
    client.authorize_contract(&external_contract);
}

#[test]
fn test_authorize_contract_requires_admin_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ReputationLedger);
    let client = ReputationLedgerClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);

    let external_contract = Address::generate(&env);
    client.authorize_contract(&external_contract);

    // Verificar que se exigió auth del admin (no del contrato externo)
    let auths = env.auths();
    assert!(auths.iter().any(|(addr, _)| *addr == admin));
}

// ─── get_reputation ──────────────────────────────────────────────────────────

#[test]
fn test_get_reputation_returns_zero_for_unknown_user() {
    let env = Env::default();
    let (client, _) = setup(&env);

    let unknown = Address::generate(&env);
    let category = cat_design(&env);

    assert_eq!(client.get_reputation(&unknown, &category), 0);
}

#[test]
fn test_get_reputation_returns_zero_for_unknown_category() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);
    let known_cat = cat_design(&env);
    let unknown_cat = cat_backend(&env);

    // Agregar reputación en "design"
    client.add_reputation(&admin, &user, &known_cat, &10);

    // Consultar en "backend" debe retornar 0
    assert_eq!(client.get_reputation(&user, &unknown_cat), 0);
}

#[test]
fn test_get_reputation_returns_correct_value_after_add() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);
    let category = cat_design(&env);

    client.add_reputation(&admin, &user, &category, &25);

    assert_eq!(client.get_reputation(&user, &category), 25);
}

#[test]
fn test_get_reputation_is_independent_per_category() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);
    let design = cat_design(&env);
    let backend = cat_backend(&env);

    client.add_reputation(&admin, &user, &design, &10);
    client.add_reputation(&admin, &user, &backend, &50);

    assert_eq!(client.get_reputation(&user, &design), 10);
    assert_eq!(client.get_reputation(&user, &backend), 50);
}

#[test]
fn test_get_reputation_is_independent_per_user() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let category = cat_design(&env);

    client.add_reputation(&admin, &user_a, &category, &30);
    client.add_reputation(&admin, &user_b, &category, &70);

    assert_eq!(client.get_reputation(&user_a, &category), 30);
    assert_eq!(client.get_reputation(&user_b, &category), 70);
}

// ─── add_reputation ──────────────────────────────────────────────────────────

#[test]
fn test_add_reputation_accumulates() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);
    let category = cat_design(&env);

    client.add_reputation(&admin, &user, &category, &10);
    client.add_reputation(&admin, &user, &category, &15);
    client.add_reputation(&admin, &user, &category, &5);

    assert_eq!(client.get_reputation(&user, &category), 30);
}

#[test]
fn test_add_reputation_zero_delta_is_noop() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);
    let category = cat_design(&env);

    client.add_reputation(&admin, &user, &category, &0);

    assert_eq!(client.get_reputation(&user, &category), 0);
}

#[test]
fn test_add_reputation_requires_admin_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ReputationLedger);
    let client = ReputationLedgerClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);

    let user = Address::generate(&env);
    let category = cat_design(&env);

    client.add_reputation(&admin, &user, &category, &10);

    // Verificar que admin fue el signer exigido
    let auths = env.auths();
    assert!(auths.iter().any(|(addr, _)| *addr == admin));
}

#[test]
#[should_panic(expected = "only admin can add reputation")]
fn test_add_reputation_non_admin_panics() {
    let env = Env::default();
    let (client, _admin) = setup(&env);

    let impostor = Address::generate(&env);
    let user = Address::generate(&env);
    let category = cat_design(&env);

    // El impostor intenta llamar como caller — debe fallar
    client.add_reputation(&impostor, &user, &category, &10);
}

// ─── remove_reputation ───────────────────────────────────────────────────────

#[test]
fn test_remove_reputation_decrements_correctly() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);
    let category = cat_design(&env);

    client.add_reputation(&admin, &user, &category, &50);
    client.remove_reputation(&admin, &user, &category, &20);

    assert_eq!(client.get_reputation(&user, &category), 30);
}

#[test]
fn test_remove_reputation_to_zero() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);
    let category = cat_design(&env);

    client.add_reputation(&admin, &user, &category, &10);
    client.remove_reputation(&admin, &user, &category, &10);

    assert_eq!(client.get_reputation(&user, &category), 0);
}

#[test]
fn test_remove_reputation_requires_admin_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ReputationLedger);
    let client = ReputationLedgerClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);

    let user = Address::generate(&env);
    let category = cat_design(&env);

    client.add_reputation(&admin, &user, &category, &50);
    client.remove_reputation(&admin, &user, &category, &10);

    let auths = env.auths();
    assert!(auths.iter().any(|(addr, _)| *addr == admin));
}

#[test]
#[should_panic(expected = "only admin can remove reputation")]
fn test_remove_reputation_non_admin_panics() {
    let env = Env::default();
    let (client, _admin) = setup(&env);

    let impostor = Address::generate(&env);
    let user = Address::generate(&env);
    let category = cat_design(&env);

    client.remove_reputation(&impostor, &user, &category, &5);
}

// ─── is_banned ───────────────────────────────────────────────────────────────

#[test]
fn test_is_banned_returns_false_by_default() {
    let env = Env::default();
    let (client, _) = setup(&env);

    let user = Address::generate(&env);

    assert!(!client.is_banned(&user));
}

#[test]
fn test_is_banned_returns_true_after_shadowban() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);

    client.shadowban(&admin, &user);

    assert!(client.is_banned(&user));
}

#[test]
fn test_is_banned_returns_false_after_unban() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);

    client.shadowban(&admin, &user);
    client.unban(&admin, &user);

    assert!(!client.is_banned(&user));
}

// ─── shadowban ───────────────────────────────────────────────────────────────

#[test]
fn test_shadowban_requires_admin_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ReputationLedger);
    let client = ReputationLedgerClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);

    let user = Address::generate(&env);
    client.shadowban(&admin, &user);

    let auths = env.auths();
    assert!(auths.iter().any(|(addr, _)| *addr == admin));
}

#[test]
#[should_panic(expected = "only admin can shadowban")]
fn test_shadowban_non_admin_panics() {
    let env = Env::default();
    let (client, _admin) = setup(&env);

    let impostor = Address::generate(&env);
    let user = Address::generate(&env);

    client.shadowban(&impostor, &user);
}

#[test]
fn test_shadowban_idempotent() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);

    client.shadowban(&admin, &user);
    client.shadowban(&admin, &user); // segunda llamada no debe hacer panic

    assert!(client.is_banned(&user));
}

#[test]
fn test_shadowban_does_not_affect_other_users() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);

    client.shadowban(&admin, &user_a);

    assert!(client.is_banned(&user_a));
    assert!(!client.is_banned(&user_b));
}

// ─── unban ───────────────────────────────────────────────────────────────────

#[test]
fn test_unban_requires_admin_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ReputationLedger);
    let client = ReputationLedgerClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);

    let user = Address::generate(&env);
    client.shadowban(&admin, &user);
    client.unban(&admin, &user);

    let auths = env.auths();
    assert!(auths.iter().any(|(addr, _)| *addr == admin));
}

#[test]
#[should_panic(expected = "only admin can unban")]
fn test_unban_non_admin_panics() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let impostor = Address::generate(&env);
    let user = Address::generate(&env);

    client.shadowban(&admin, &user);
    client.unban(&impostor, &user);
}

#[test]
fn test_unban_user_not_previously_banned_is_noop() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);

    // Llamar unban sobre un usuario que nunca fue baneado no debe hacer panic
    client.unban(&admin, &user);

    assert!(!client.is_banned(&user));
}

// ─── Flujos combinados ────────────────────────────────────────────────────────

#[test]
fn test_full_reputation_lifecycle() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let user = Address::generate(&env);
    let design = cat_design(&env);
    let backend = cat_backend(&env);

    // Sin reputación inicial
    assert_eq!(client.get_reputation(&user, &design), 0);
    assert_eq!(client.get_reputation(&user, &backend), 0);

    // Ganar eventos → acumular
    client.add_reputation(&admin, &user, &design, &10);
    client.add_reputation(&admin, &user, &design, &10);
    client.add_reputation(&admin, &user, &backend, &5);

    assert_eq!(client.get_reputation(&user, &design), 20);
    assert_eq!(client.get_reputation(&user, &backend), 5);

    // Sanción parcial
    client.remove_reputation(&admin, &user, &design, &8);
    assert_eq!(client.get_reputation(&user, &design), 12);

    // Baneo y desbaneo
    assert!(!client.is_banned(&user));
    client.shadowban(&admin, &user);
    assert!(client.is_banned(&user));
    client.unban(&admin, &user);
    assert!(!client.is_banned(&user));

    // Reputación no se altera por el ban/unban
    assert_eq!(client.get_reputation(&user, &design), 12);
}

#[test]
fn test_multiple_users_isolated() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);
    let category = cat_design(&env);

    client.add_reputation(&admin, &alice, &category, &100);
    client.add_reputation(&admin, &bob, &category, &50);
    client.shadowban(&admin, &carol);

    assert_eq!(client.get_reputation(&alice, &category), 100);
    assert_eq!(client.get_reputation(&bob, &category), 50);
    assert_eq!(client.get_reputation(&carol, &category), 0);

    assert!(!client.is_banned(&alice));
    assert!(!client.is_banned(&bob));
    assert!(client.is_banned(&carol));
}

#[test]
fn test_authorized_contract_registered_then_admin_can_update_rep() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    // Simular dirección de otro contrato
    let event_contract = Address::generate(&env);
    client.authorize_contract(&event_contract);

    // El admin sigue pudiendo actualizar reputación normalmente
    let user = Address::generate(&env);
    let category = cat_design(&env);

    client.add_reputation(&admin, &user, &category, &10);
    assert_eq!(client.get_reputation(&user, &category), 10);
}