// soroban.helper.js
// Helpers para construir, simular, firmar y enviar transacciones Soroban.

const {
  Contract,
  rpc,
  TransactionBuilder,
  xdr,
} = require('@stellar/stellar-sdk');

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

  // 1. Simular para obtener los recursos necesarios
  const simResult = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation error: ${simResult.error}`);
  }

  // 2. Preparar la transacción con footprint y recursos
  const preparedTx = rpc.assembleTransaction(tx, simResult).build();

  // 3. Firmar
  preparedTx.sign(signerKeypair);

  // 4. Enviar
  const sendResult = await server.sendTransaction(preparedTx);

  if (sendResult.status === 'ERROR') {
    throw new Error(`Send error: ${JSON.stringify(sendResult.errorResult)}`);
  }

  // 5. Polling hasta confirmación
  let response;
  do {
    await new Promise(r => setTimeout(r, 2000));
    response = await server.getTransaction(sendResult.hash);
  } while (response.status === rpc.Api.GetTransactionStatus.NOT_FOUND);

  if (response.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(`Transaction failed: ${sendResult.hash}`);
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
