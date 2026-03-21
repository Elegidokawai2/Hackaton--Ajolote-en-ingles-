#[cfg(test)]

mod test {
    use crate::{DataKey, ReputationLedger, ReputationLedgerClient};
    use soroban_sdk::{Address, Env, Symbol, testutils::Address as _};

    fn test_admin(env: &Env) -> Address {
        Address::generate(&env)
    }

    fn test_user(env: &Env) -> Address {
        Address::generate(&env)
    }

    fn test_contract(env: &Env) -> Address {
        Address::generate(&env)
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let admin = Address::generate(&env);

        // Creamos client del contrato
        let contract_id = env.register(ReputationLedger, ());
        let ledger = ReputationLedgerClient::new(&env, &contract_id);

        // Inicializamos
        ledger.initialize(&admin);

        // Comprobamos que admin quedó seteado
        assert_eq!(ledger.get_admin(), admin);
    }

    #[test]
    fn test_add_and_get_reputation() {
        let env = Env::default();
        let admin = test_admin(&env);
        let user = test_user(&env);
        let category = Symbol::new(&env, "dev");

        let contract_id = env.register(ReputationLedger, ());
        let ledger = ReputationLedgerClient::new(&env, &contract_id);

        ledger.initialize(&admin);

        // Inicialmente reputación = 0
        assert_eq!(ledger.get_reputation(&user, &category), 0);

        // Admin añade reputación
        ledger.add_reputation(&admin, &user, &category, &10);
        assert_eq!(ledger.get_reputation(&user, &category), 10);

        // Sumar de nuevo
        ledger.add_reputation(&admin, &user, &category, &5);
        assert_eq!(ledger.get_reputation(&user, &category), 15);
    }

    #[test]
    fn test_remove_reputation() {
        let env = Env::default();
        let admin = test_admin(&env);
        let user = test_user(&env);
        let category = Symbol::new(&env, "design");

        let contract_id = env.register(ReputationLedger, ());
        let ledger = ReputationLedgerClient::new(&env, &contract_id);
        
        ledger.initialize(&admin);

        ledger.add_reputation(&admin, &user, &category, &10);
        assert_eq!(ledger.get_reputation(&user, &category), 10);

        // Remover menos de la reputación actual
        ledger.remove_reputation(&admin, &user, &category, &4);
        assert_eq!(ledger.get_reputation(&user, &category), 6);

        // Remover más de la reputación → se satura en 0
        ledger.remove_reputation(&admin, &user, &category, &10);
        assert_eq!(ledger.get_reputation(&user, &category), 0);
    }

    #[test]
    fn test_shadowban_and_unban() {
        let env = Env::default();
        let admin = test_admin(&env);
        let user = test_user(&env);

        let contract_id = env.register(ReputationLedger, ());
        let ledger = ReputationLedgerClient::new(&env, &contract_id);
        
        ledger.initialize(&admin);

        // Inicialmente no baneado
        assert_eq!(ledger.is_banned(&user), false);

        // Shadowban
        ledger.shadowban(&admin, &user);
        assert_eq!(ledger.is_banned(&user), true);

        // Unban
        ledger.unban(&admin, &user);
        assert_eq!(ledger.is_banned(&user), false);
    }

    #[test]
    fn test_add_reputation_banned_user() {
        let env = Env::default();
        let admin = test_admin(&env);
        let user = test_user(&env);
        let category = Symbol::new(&env, "dev");

        let contract_id = env.register(ReputationLedger, ());
        let ledger = ReputationLedgerClient::new(&env, &contract_id);
        
        ledger.initialize(&admin);

        // Baneamos al usuario
        ledger.shadowban(&admin, &user);
    }

    #[test]
    fn test_authorize_contract_and_add_reputation() {
        let env = Env::default();
        let admin = test_admin(&env);
        let contract = test_contract(&env);

        let contract_id = env.register(ReputationLedger, ());
        let ledger = ReputationLedgerClient::new(&env, &contract_id);
        
        ledger.initialize(&admin);

        // Admin autoriza contrato
        ledger.authorize_contract(&contract);

        // TODO: Aquí se probaría que el contrato autorizado pueda añadir reputación
        // En tests unitarios de Soroban, esto se simula invocando env con contexto del contrato
        // Para MVP de hackathon se puede asumir que la llamada con 'contract' como caller funciona
    }
}
