#![no_std]
use soroban_sdk::{Address, Env, String, Vec, contract, contractimpl, vec};

#[contract]
pub struct ProjectContract;

#[contractimpl]
impl ProjectContract {
    //Creación de un nuevo proyecto
    // guarantee = n% del amount, depositado por el reclutador
    pub fn create_project(env: Env, recruiter: Address, freelancer: Address, amount: i128, guarantee: i128, deadline: u64) -> ProjectId {
        vec![&env, String::from_str(&env, "Hello")]
    }
    
    pub fn accept_project(env: Env, project_id: ProjectId, freelancer: Address) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }
    
    pub fn submit_delivery(env: Env, project_id: ProjectId, freelancer: Address, delivery_hash: BytesN<32>) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }
    
    pub fn approve_delivery(env: Env, project_id: ProjectId, recruiter: Address, platform: Address) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }
    
    pub fn request_correction(env: Env, project_id: ProjectId, recruiter: Address) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }
    
    pub fn reject_delivery(env: Env, project_id: ProjectId, recruiter: Address) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }
    
    pub fn resolve_dispute(env: Env, project_id: ProjectId, platform: Address, favor_freelancer: bool) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }
    
    pub fn timeout_approve(env: Env, project_id: ProjectId) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }
    
    pub fn timeout_refund(env: Env, project_id: ProjectId) -> Result {
        vec![&env, String::from_str(&env, "Hello")]
    }
}

mod test;
