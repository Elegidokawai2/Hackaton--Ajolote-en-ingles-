// project.contract.js
// Funciones para consumir el contrato ProjectContract desde el backend.
const crypto = require('crypto');
const { Keypair } = require('@stellar/stellar-sdk');
const { invokeContract, queryContract } = require('./soroban.helper');
const { CONTRACT_IDS } = require('./soroban.client');
const { toAddress, toI128, toSymbol, toU64, toBytes32, toBool } = require('./scval.helpers');
/**
 * Inicializa el contrato de proyectos (solo una vez al desplegar).
 * Firma Rust: initialize(admin, token, reputation_addr, platform_addr, wallet_registry_addr)
 * @param {Keypair} adminKeypair          - Keypair del admin
 * @param {string}  tokenAddress          - Address del token MXNe para escrow
 * @param {string}  reputationContractAddr - Address del contrato de reputación
 * @param {string}  platformAddr          - Address de la wallet de la plataforma
 */
async function initializeProject(adminKeypair, tokenAddress, reputationContractAddr, platformAddr) {
    return invokeContract(
        CONTRACT_IDS.project,
        'initialize',
        [
            toAddress(adminKeypair.publicKey()),
            toAddress(tokenAddress),
            toAddress(reputationContractAddr),
            toAddress(platformAddr),
            toAddress(CONTRACT_IDS.walletRegistry),
        ],
        adminKeypair
    );
}
/**
 * Crea un nuevo proyecto con escrow de amount + guarantee.
 * @param {Keypair} recruiterKeypair     - Keypair del reclutador
 * @param {string}  freelancerPublicKey  - Public key del freelancer asignado
 * @param {number|string} amount         - Monto del proyecto
 * @param {number|string} guarantee      - Garantía del freelancer
 * @param {number|string} deadline       - Unix timestamp de deadline
 * @param {string}  category             - Categoría del proyecto
 * @returns {Promise<string>} project_id
 */
async function createProject(recruiterKeypair, freelancerPublicKey, amount, guarantee, deadline, category) {
    const response = await invokeContract(
        CONTRACT_IDS.project,
        'create_project',
        [
            toAddress(recruiterKeypair.publicKey()),
            toAddress(freelancerPublicKey),
            toI128(amount),
            toI128(guarantee),
            toU64(deadline),
            toSymbol(category),
        ],
        recruiterKeypair
    );
    return response.returnValue?.u64()?.toString();
}
/**
 * El freelancer acepta un proyecto asignado.
 * @param {Keypair} freelancerKeypair    - Keypair del freelancer
 * @param {number|string} projectId      - ID del proyecto
 */
async function acceptProject(freelancerKeypair, projectId) {
    return invokeContract(
        CONTRACT_IDS.project,
        'accept_project',
        [
            toU64(projectId),
            toAddress(freelancerKeypair.publicKey()),
        ],
        freelancerKeypair
    );
}
/**
 * El freelancer envía la entrega de un proyecto. Calcula el hash SHA-256.
 * @param {Keypair} freelancerKeypair    - Keypair del freelancer
 * @param {number|string} projectId      - ID del proyecto
 * @param {string}  deliveryContent      - Contenido del entregable
 * @returns {Promise<string>} Hash hex del entregable
 */
async function submitDelivery(freelancerKeypair, projectId, deliveryContent) {
    const deliveryHash = crypto.createHash('sha256').update(deliveryContent).digest('hex');
    await invokeContract(
        CONTRACT_IDS.project,
        'submit_delivery',
        [
            toU64(projectId),
            toAddress(freelancerKeypair.publicKey()),
            toBytes32(deliveryHash),
        ],
        freelancerKeypair
    );
    return deliveryHash;
}
/**
 * El reclutador aprueba la entrega de un proyecto.
 * @param {Keypair} recruiterKeypair     - Keypair del reclutador
 * @param {number|string} projectId      - ID del proyecto
 */
async function approveDelivery(recruiterKeypair, projectId) {
    return invokeContract(
        CONTRACT_IDS.project,
        'approve_delivery',
        [
            toU64(projectId),
            toAddress(recruiterKeypair.publicKey()),
        ],
        recruiterKeypair
    );
}
/**
 * El reclutador solicita una corrección al freelancer.
 * @param {Keypair} recruiterKeypair     - Keypair del reclutador
 * @param {number|string} projectId      - ID del proyecto
 */
async function requestCorrection(recruiterKeypair, projectId) {
    return invokeContract(
        CONTRACT_IDS.project,
        'request_correction',
        [
            toU64(projectId),
            toAddress(recruiterKeypair.publicKey()),
        ],
        recruiterKeypair
    );
}
/**
 * El reclutador rechaza la entrega de un proyecto.
 * @param {Keypair} recruiterKeypair     - Keypair del reclutador
 * @param {number|string} projectId      - ID del proyecto
 */
async function rejectDelivery(recruiterKeypair, projectId) {
    return invokeContract(
        CONTRACT_IDS.project,
        'reject_delivery',
        [
            toU64(projectId),
            toAddress(recruiterKeypair.publicKey()),
        ],
        recruiterKeypair
    );
}
/**
 * Admin resuelve una disputa a favor o en contra del freelancer.
 * @param {Keypair} adminKeypair         - Keypair del admin de la plataforma
 * @param {number|string} projectId      - ID del proyecto
 * @param {boolean} favorFreelancer      - true = a favor del freelancer
 */
async function resolveDispute(adminKeypair, projectId, favorFreelancer) {
    return invokeContract(
        CONTRACT_IDS.project,
        'resolve_dispute',
        [
            toU64(projectId),
            toAddress(adminKeypair.publicKey()),
            toBool(favorFreelancer),
        ],
        adminKeypair
    );
}
/**
 * Aprueba automáticamente por timeout (puede ser llamado por cualquier cuenta).
 * @param {Keypair} platformKeypair      - Keypair de la plataforma
 * @param {number|string} projectId      - ID del proyecto
 */
async function timeoutApprove(platformKeypair, projectId) {
    return invokeContract(
        CONTRACT_IDS.project,
        'timeout_approve',
        [toU64(projectId)],
        platformKeypair
    );
}
/**
 * Reembolsa automáticamente por timeout (puede ser llamado por cualquier cuenta).
 * @param {Keypair} platformKeypair      - Keypair de la plataforma
 * @param {number|string} projectId      - ID del proyecto
 */
async function timeoutRefund(platformKeypair, projectId) {
    return invokeContract(
        CONTRACT_IDS.project,
        'timeout_refund',
        [toU64(projectId)],
        platformKeypair
    );
}
/**
 * Consulta los datos de un proyecto (solo lectura).
 * @param {string} callerPublicKey       - Public key del caller
 * @param {number|string} projectId      - ID del proyecto
 * @returns {Promise<object>} Datos del proyecto
 */
async function getProject(callerPublicKey, projectId) {
    return queryContract(
        CONTRACT_IDS.project,
        'get_project',
        [toU64(projectId)],
        callerPublicKey
    );
}

module.exports = {
    initializeProject,
    createProject,
    acceptProject,
    submitDelivery,
    approveDelivery,
    requestCorrection,
    rejectDelivery,
    resolveDispute,
    timeoutApprove,
    timeoutRefund,
    getProject,
};