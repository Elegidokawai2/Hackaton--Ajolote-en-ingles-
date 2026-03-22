// reputation.contract.js
// Funciones para consumir el contrato ReputationLedger desde el backend.

const { invokeContract, queryContract } = require('./soroban.helper');
const { CONTRACT_IDS } = require('./soroban.client');
const { toAddress, toSymbol, toU32 } = require('./scval.helpers');

/**
 * Inicializa el contrato de reputación (solo una vez al desplegar).
 * Recibe adicionalmente la dirección del WalletRegistry para cross-contract calls
 * de validación en add_reputation y remove_reputation.
 * @param {Keypair} adminKeypair - Keypair del admin
 */
async function initializeReputation(adminKeypair) {
  return invokeContract(
    CONTRACT_IDS.reputation,
    'initialize',
    [
      toAddress(adminKeypair.publicKey()),
      toAddress(CONTRACT_IDS.walletRegistry),
    ],
    adminKeypair
  );
}

/**
 * Agrega reputación a un usuario en una categoría específica.
 * @param {Keypair} adminKeypair  - Keypair del admin
 * @param {string}  userPublicKey - Public key del usuario
 * @param {string}  category      - Categoría (ej: "design", "dev")
 * @param {number}  delta         - Cantidad de reputación a agregar
 */
async function addReputation(adminKeypair, userPublicKey, category, delta) {
  return invokeContract(
    CONTRACT_IDS.reputation,
    'add_reputation',
    [
      toAddress(adminKeypair.publicKey()),
      toAddress(userPublicKey),
      toSymbol(category),
      toU32(delta),
    ],
    adminKeypair
  );
}

/**
 * Remueve reputación de un usuario en una categoría específica.
 * El contrato valida internamente que la wallet esté activa (cross-contract call
 * a is_active_by_wallet). Incluye guard de underflow: si delta > reputación actual,
 * el contrato hace panic. Pre-valida con getReputation si necesitas evitar el error.
 * @param {Keypair} adminKeypair  - Keypair del admin
 * @param {string}  userPublicKey - Public key del usuario
 * @param {string}  category      - Categoría (ej: "design", "dev")
 * @param {number}  delta         - Cantidad de reputación a remover
 */
async function removeReputation(adminKeypair, userPublicKey, category, delta) {
  return invokeContract(
    CONTRACT_IDS.reputation,
    'remove_reputation',
    [
      toAddress(adminKeypair.publicKey()),
      toAddress(userPublicKey),
      toSymbol(category),
      toU32(delta),
    ],
    adminKeypair
  );
}

/**
 * Consulta la reputación de un usuario en una categoría (solo lectura).
 * @param {string} callerPublicKey - Public key del caller
 * @param {string} userPublicKey   - Public key del usuario a consultar
 * @param {string} category        - Categoría
 * @returns {Promise<number>} Valor de reputación
 */
async function getReputation(callerPublicKey, userPublicKey, category) {
  const result = await queryContract(
    CONTRACT_IDS.reputation,
    'get_reputation',
    [toAddress(userPublicKey), toSymbol(category)],
    callerPublicKey
  );

  return result ? Number(result.u32()) : 0;
}

/**
 * Verifica si un usuario está baneado (solo lectura).
 * @param {string} callerPublicKey - Public key del caller
 * @param {string} userPublicKey   - Public key del usuario a verificar
 * @returns {Promise<boolean>}
 */
async function isBanned(callerPublicKey, userPublicKey) {
  const result = await queryContract(
    CONTRACT_IDS.reputation,
    'is_banned',
    [toAddress(userPublicKey)],
    callerPublicKey
  );

  return result?.b() ?? false;
}

/**
 * Aplica shadowban a un usuario (solo admin).
 * @param {Keypair} adminKeypair    - Keypair del admin
 * @param {string}  userPublicKey   - Public key del usuario a banear
 */
async function shadowban(adminKeypair, userPublicKey) {
  return invokeContract(
    CONTRACT_IDS.reputation,
    'shadowban',
    [
      toAddress(adminKeypair.publicKey()),
      toAddress(userPublicKey),
    ],
    adminKeypair
  );
}

/**
 * Revierte el shadowban de un usuario (solo admin).
 * @param {Keypair} adminKeypair    - Keypair del admin
 * @param {string}  userPublicKey   - Public key del usuario a desbanear
 */
async function unban(adminKeypair, userPublicKey) {
  return invokeContract(
    CONTRACT_IDS.reputation,
    'unban',
    [
      toAddress(adminKeypair.publicKey()),
      toAddress(userPublicKey),
    ],
    adminKeypair
  );
}

module.exports = {
  initializeReputation,
  addReputation,
  removeReputation,
  getReputation,
  isBanned,
  shadowban,
  unban,
};
