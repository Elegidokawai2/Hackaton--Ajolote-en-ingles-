#![no_std]
use soroban_sdk::{Address, BytesN, Env, String, Symbol, Vec, contract, contractimpl, vec, xdr::VecM};

#[contract]
pub struct EventContract;

#[contractimpl]
impl EventContract {
    //Creación de un nuevo evento/competencia del sistema
    pub fn create_event(env: Env, recruiter: Address, prize: i128, category: Symbol, deadline_submit: u64, deadline_select: u64) -> EventId {
        vec![&env, String::from_str(&env, "Hello")]
    }

    //Aplicación de un freelancer a un evento
    pub fn apply_to_event(env: Env, event_id: EventId, freelancer: Address) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }

    //Subida de código/entregables de la competencia
    pub fn submit_entry(env: Env, event_id: EventId, freelancer: Address, entry_hash: BytesN<32>) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }

    //Selección de n ganadores en el evento
    pub fn select_winners(env: Env, event_id: EventId, winners: Vec, platform: Address) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }

    //En caso de que el reclutador (quien publicó el evento) no indique ganadores antes de que se acabe el tiempo
    pub fn timeout_distribute(env: Env, event_id: EventId, platform: Address) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }
}

mod test;
