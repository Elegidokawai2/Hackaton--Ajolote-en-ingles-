// event.contract.js
// Funciones para consumir el contrato EventContract desde el backend.

const crypto = require('crypto');
const { Keypair } = require('@stellar/stellar-sdk');
const { invokeContract, queryContract } = require('./soroban.helper');
const { CONTRACT_IDS } = require('./soroban.client');
const { toAddress, toI128, toSymbol, toU64, toBytes32, toAddressVec } = require('./scval.helpers');

/**
 * Crea un nuevo evento con premio en escrow.
 * @param {Keypair} recruiterKeypair - Keypair del reclutador
 * @param {number|string} prize      - Premio en stroops/unidades del token
 * @param {string} category          - Categoría (ej: "design")
 * @param {number|string} deadlineSubmit - Unix timestamp límite de entregas
 * @param {number|string} deadlineSelect - Unix timestamp límite de selección
 * @returns {Promise<string>} event_id
 */
async function createEvent(recruiterKeypair, prize, category, deadlineSubmit, deadlineSelect) {
  const response = await invokeContract(
    CONTRACT_IDS.event,
    'create_event',
    [
      toAddress(recruiterKeypair.publicKey()),
      toI128(prize),
      toSymbol(category),
      toU64(deadlineSubmit),
      toU64(deadlineSelect),
    ],
    recruiterKeypair
  );

  return response.returnValue?.u64()?.toString();
}

/**
 * Aplica a un evento como freelancer.
 * @param {Keypair} freelancerKeypair - Keypair del freelancer
 * @param {number|string} eventId     - ID del evento
 */
async function applyToEvent(freelancerKeypair, eventId) {
  return invokeContract(
    CONTRACT_IDS.event,
    'apply_to_event',
    [
      toU64(eventId),
      toAddress(freelancerKeypair.publicKey()),
    ],
    freelancerKeypair
  );
}

/**
 * Envía una entrada a un evento. Calcula el hash SHA-256 del contenido.
 * @param {Keypair} freelancerKeypair - Keypair del freelancer
 * @param {number|string} eventId     - ID del evento
 * @param {string} entryContent       - Contenido del entregable
 * @returns {Promise<string>} Hash hex del entregable
 */
async function submitEntry(freelancerKeypair, eventId, entryContent) {
  const entryHash = crypto.createHash('sha256').update(entryContent).digest('hex');

  await invokeContract(
    CONTRACT_IDS.event,
    'submit_entry',
    [
      toU64(eventId),
      toAddress(freelancerKeypair.publicKey()),
      toBytes32(entryHash),
    ],
    freelancerKeypair
  );

  return entryHash;
}

/**
 * Selecciona los ganadores de un evento.
 * @param {Keypair}  recruiterKeypair - Keypair del reclutador
 * @param {number|string} eventId    - ID del evento
 * @param {string[]} winners          - Array de public keys de los ganadores
 */
async function selectWinners(recruiterKeypair, eventId, winners) {
  return invokeContract(
    CONTRACT_IDS.event,
    'select_winners',
    [
      toU64(eventId),
      toAddressVec(winners),
    ],
    recruiterKeypair
  );
}

/**
 * Distribuye fondos por timeout (puede ser llamado por cualquier cuenta).
 * @param {Keypair} platformKeypair  - Keypair de la plataforma
 * @param {number|string} eventId    - ID del evento
 */
async function timeoutDistribute(platformKeypair, eventId) {
  return invokeContract(
    CONTRACT_IDS.event,
    'timeout_distribute',
    [toU64(eventId)],
    platformKeypair
  );
}

/**
 * Consulta los datos de un evento (solo lectura).
 * @param {string} callerPublicKey   - Public key del caller
 * @param {number|string} eventId    - ID del evento
 * @returns {Promise<object>} Datos del evento
 */
async function getEvent(callerPublicKey, eventId) {
  return queryContract(
    CONTRACT_IDS.event,
    'get_event',
    [toU64(eventId)],
    callerPublicKey
  );
}

module.exports = {
  createEvent,
  applyToEvent,
  submitEntry,
  selectWinners,
  timeoutDistribute,
  getEvent,
};
