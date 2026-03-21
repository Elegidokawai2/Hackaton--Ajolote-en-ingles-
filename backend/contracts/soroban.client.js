// soroban.client.js
// Configuración base del cliente Soroban RPC para todos los contratos.

const { rpc, Keypair, Networks, TransactionBuilder, BASE_FEE } = require('@stellar/stellar-sdk');

const SERVER_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.NETWORK === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET;

const server = new rpc.Server(SERVER_URL, { allowHttp: false });

// IDs de contratos desplegados (se leen de variables de entorno)
const CONTRACT_IDS = {
  reputation: process.env.REPUTATION_CONTRACT_ID,
  event:      process.env.EVENT_CONTRACT_ID,
  project:    process.env.PROJECT_CONTRACT_ID,
};

module.exports = { server, NETWORK_PASSPHRASE, CONTRACT_IDS, BASE_FEE };
