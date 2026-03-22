// soroban.helper.js
// Helpers para construir, simular, firmar y enviar transacciones Soroban.

const {
  Contract,
  TransactionBuilder,
  xdr,
  authorizeEntry,
  SorobanDataBuilder,
} = require('@stellar/stellar-sdk');

const rpc = require('@stellar/stellar-sdk').rpc;

const { server, NETWORK_PASSPHRASE, BASE_FEE } = require('./soroban.client');

/**
 * Ejecuta una función de un contrato Soroban que requiere firma.
 *
 * @param {string}      contractId    - ID del contrato (C...)
 * @param {string}      method        - Nombre de la función del contrato
 * @param {xdr.ScVal[]} args          - Argumentos en formato ScVal
 * @param {Keypair}     signerKeypair - Keypair del firmante
 * @returns {Promise<object>} Respuesta de la transacción confirmada
 */

async function invokeContract(contractId, method, args, signerKeypair) {
  const account = await server.getAccount(signerKeypair.publicKey());
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // 1. Simular
  const simResult = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(simResult.error);
  }

  // 2. Autorizar entradas que requieran firma del signerKeypair
  //    Esto resuelve el require_auth() dentro del contrato
  let authEntries = simResult.result?.auth ?? [];
  if (authEntries.length > 0) {
    const ledger = await server.getLatestLedger();
    authEntries = await Promise.all(
      authEntries.map(entry =>
        authorizeEntry(
          entry,
          signerKeypair,
          ledger.sequence + 100, // validUntilLedgerSeq
          NETWORK_PASSPHRASE
        )
      )
    );
  }

  // 3. Ensamblar con auth firmadas
  const preparedTx = rpc.assembleTransaction(tx, {
    ...simResult,
    result: simResult.result
      ? { ...simResult.result, auth: authEntries }
      : simResult.result,
  }).build();

  // 4. Firmar la transacción completa
  preparedTx.sign(signerKeypair);

  // 5. Enviar
  const sendResult = await server.sendTransaction(preparedTx);

  if (sendResult.status === 'ERROR') {
    throw new Error(JSON.stringify(sendResult.errorResult));
  }

  // 6. Polling
  let response;
  do {
    await new Promise(r => setTimeout(r, 2000));
    response = await server.getTransaction(sendResult.hash);
  } while (response.status === rpc.Api.GetTransactionStatus.NOT_FOUND);

  if (response.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(sendResult.hash);
  }

  return response;
}

/**
 * Ejecuta una función de solo lectura (sin firma, sin fees).
 *
 * @param {string}      contractId      - ID del contrato (C...)
 * @param {string}      method          - Nombre de la función del contrato
 * @param {xdr.ScVal[]} args            - Argumentos en formato ScVal
 * @param {string}      callerPublicKey - Public key del caller (solo para construir la tx)
 * @returns {Promise<xdr.ScVal|undefined>} Valor de retorno de la simulación
 */
async function queryContract(contractId, method, args, callerPublicKey) {
  const account = await server.getAccount(callerPublicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Query error: ${simResult.error}`);
  }

  return simResult.result?.retval;
}

module.exports = { invokeContract, queryContract };
