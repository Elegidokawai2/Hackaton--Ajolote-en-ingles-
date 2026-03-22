const StellarSdk = require('@stellar/stellar-sdk');
const { Keypair, Networks, Contract, TransactionBuilder, BASE_FEE, Asset } = StellarSdk;

// Note: Ensure your environment variables are set correctly for Stellar RPC and Network Passphrase
const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;

// Stellar SDK v14+ moved Server to rpc submodule
let server;
try {
    const SorobanServer = StellarSdk.rpc ? StellarSdk.rpc.Server : StellarSdk.SorobanRpc?.Server;
    if (SorobanServer) {
        server = new SorobanServer(rpcUrl);
    }
} catch (e) {
    console.warn('Stellar RPC server not initialized (mock mode):', e.message);
}

/**
 * Utility Service to interact with Soroban Smart Contracts.
 * Contracts assumed to be deployed on Testnet/Futurenet.
 * 
 * TODO: Replace these placeholder contract IDs with the actual deployed Contract IDs
 * from the soroban-contracts directory after running `soroban contract deploy`.
 */
const CONTRACT_IDS = {
    EVENT: process.env.EVENT_CONTRACT_ID || 'C_MOCK_EVENT_ID',
    PROJECT: process.env.PROJECT_CONTRACT_ID || 'C_MOCK_PROJECT_ID',
    REPUTATION: process.env.REPUTATION_CONTRACT_ID || 'C_MOCK_REPUTATION_ID'
};

/**
 * Generic handler to build and submit a transaction to Soroban
 */
async function submitContractCall(contractId, method, args = [], sourceSecret) {
    try {
        const sourceKeypair = Keypair.fromSecret(sourceSecret);
        const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());
        const contract = new Contract(contractId);

        const tx = new TransactionBuilder(sourceAccount, {
            fee: BASE_FEE,
            networkPassphrase,
        })
        .addOperation(contract.call(method, ...args))
        .setTimeout(30)
        .build();

        tx.sign(sourceKeypair);

        // Prepare the transaction for Soroban
        const preparedTransaction = await server.prepareTransaction(tx);
        
        const response = await server.sendTransaction(preparedTransaction);
        return response;
    } catch (error) {
        console.error("Stellar Contract Call Error:", error);
        throw error;
    }
}

// ==========================================
// Event Contract Integrations
// ==========================================
async function distributeEventPrize(eventId, winnerAddress, adminSecret) {
    // Example: call 'distribute_prize' on the EVENT contract
    // submitContractCall(CONTRACT_IDS.EVENT, 'distribute_prize', [...], adminSecret);
    return { status: 'mock_success', tx_hash: 'mock_tx_hash' };
}

// ==========================================
// Project Contract Integrations
// ==========================================
async function lockProjectFunds(projectId, amount, funderSecret) {
     return { status: 'mock_success', tx_hash: 'mock_tx_hash' };
}

async function releaseProjectFunds(projectId, receiverAddress, adminSecret) {
    return { status: 'mock_success', tx_hash: 'mock_tx_hash' };
}

// ==========================================
// Reputation Contract Integrations
// ==========================================
async function recordReputationOnChain(userAddress, categoryId, delta, adminSecret) {
     return { status: 'mock_success', tx_hash: 'mock_tx_hash' };
}

// ==========================================
// Wallet Management
// ==========================================

/**
 * Creates a new Stellar keypair for a user wallet.
 * Returns { publicKey, secret }
 */
function createStellarWallet() {
    try {
        const keypair = Keypair.random();
        return {
            publicKey: keypair.publicKey(),
            secret: keypair.secret()
        };
    } catch (error) {
        console.error('Error creating Stellar wallet:', error);
        // Fallback for when SDK is not fully configured
        return {
            publicKey: `G_MOCK_${Date.now()}`,
            secret: `S_MOCK_${Date.now()}`
        };
    }
}

/**
 * Verifies a cryptographic signature from a Stellar wallet.
 * Used for wallet-based login authentication.
 */
function verifySignature(publicKey, message, signature) {
    try {
        const keypair = Keypair.fromPublicKey(publicKey);
        const messageBuffer = Buffer.from(message, 'utf8');
        const signatureBuffer = Buffer.from(signature, 'base64');
        return keypair.verify(messageBuffer, signatureBuffer);
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
}

// ==========================================
// Event Refund
// ==========================================
async function refundEventFunds(eventId, recruiterAddress, adminSecret) {
    // Mock: In production, this would call the EventContract timeout_distribute
    return { status: 'mock_success', tx_hash: 'mock_refund_tx_hash' };
}

// ==========================================
// Horizon API — On-chain Balance Queries
// ==========================================

const HORIZON_URL = process.env.NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';

/**
 * Fetches the on-chain balances for a Stellar account via the Horizon REST API.
 *
 * @param {string} stellarAddress - Public key (G…) of the account.
 * @returns {Promise<Array<{ asset_type: string, asset_code: string, asset_issuer?: string, balance: string }>>}
 *          Returns [] if the account does not exist on the network.
 */
async function getAccountBalances(stellarAddress) {
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${stellarAddress}`);

    if (res.status === 404) {
      // Account not funded / doesn't exist on-chain yet
      return [];
    }
    if (!res.ok) {
      throw new Error(`Horizon responded with ${res.status}`);
    }

    const data = await res.json();

    return (data.balances || []).map((b) => ({
      asset_type: b.asset_type,
      asset_code: b.asset_type === 'native' ? 'XLM' : b.asset_code,
      asset_issuer: b.asset_issuer,
      balance: b.balance,
    }));
  } catch (err) {
    console.error('stellarService.getAccountBalances error:', err.message);
    return [];
  }
}

/**
 * Checks whether a Stellar account exists (has been funded) on the network.
 */
async function accountExists(stellarAddress) {
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${stellarAddress}`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Funds a testnet account using the Stellar Friendbot.
 * Only works on testnet.
 */
async function fundTestnetAccount(stellarAddress) {
  if (process.env.NETWORK === 'mainnet') return false;
  try {
    const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(stellarAddress)}`);
    return res.ok;
  } catch (err) {
    console.error('stellarService.fundTestnetAccount error:', err.message);
    return false;
  }
}

module.exports = {
    submitContractCall,
    distributeEventPrize,
    lockProjectFunds,
    releaseProjectFunds,
    recordReputationOnChain,
    createStellarWallet,
    verifySignature,
    refundEventFunds,
    getAccountBalances,
    accountExists,
    fundTestnetAccount,
};
