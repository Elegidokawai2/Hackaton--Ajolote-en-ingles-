# consume.contracts.md

> Guía de integración: cómo invocar los contratos inteligentes de ProofWork desde un backend **Express + Node.js**

---

## Dependencias requeridas

```bash
npm install @stellar/stellar-sdk
```

> Se usa `@stellar/stellar-sdk` v12+. Asegúrate de que la versión del SDK sea compatible con el protocolo de la red donde están desplegados los contratos.

---

## Configuración base

Crea un archivo `soroban.client.js` reutilizable en todos los servicios:

```js
// soroban.client.js
const { SorobanRpc, Keypair, Networks, TransactionBuilder, BASE_FEE } = require('@stellar/stellar-sdk');

const SERVER_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.NETWORK === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET;

const server = new SorobanRpc.Server(SERVER_URL, { allowHttp: false });

// IDs de contratos desplegados
const CONTRACT_IDS = {
  reputation: process.env.REPUTATION_CONTRACT_ID,
  event:      process.env.EVENT_CONTRACT_ID,
  project:    process.env.PROJECT_CONTRACT_ID,
};

module.exports = { server, NETWORK_PASSPHRASE, CONTRACT_IDS, BASE_FEE };
```

---

## Helper: construir y enviar una transacción

La mayoría de funciones de escritura siguen el mismo patrón:
1. Simular la transacción (`simulateTransaction`)
2. Preparar la transacción con los recursos de la simulación (`assembleTransaction`)
3. Firmar con el keypair del caller
4. Enviar y esperar confirmación (`sendTransaction` + polling)

```js
// soroban.helper.js
const {
  Contract,
  SorobanRpc,
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

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation error: ${simResult.error}`);
  }

  // 2. Preparar la transacción con footprint y recursos
  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();

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
  } while (response.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND);

  if (response.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(`Transaction failed: ${sendResult.hash}`);
  }

  return response;
}

/**
 * Ejecuta una función de solo lectura (sin firma, sin fees).
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

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Query error: ${simResult.error}`);
  }

  return simResult.result?.retval;
}

module.exports = { invokeContract, queryContract };
```

---

## Conversión de tipos (`ScVal`)

Soroban requiere que los argumentos se pasen como `xdr.ScVal`. Estos son los conversores más frecuentes para los contratos de ProofWork:

```js
// scval.helpers.js
const { Address, nativeToScVal, xdr } = require('@stellar/stellar-sdk');

// Address (reclutador, freelancer, admin, etc.)
const toAddress = (pubkey) => new Address(pubkey).toScVal();

// u64 (event_id, project_id, deadline, timestamps)
const toU64 = (n) => nativeToScVal(BigInt(n), { type: 'u64' });

// i128 (prize, amount, guarantee)
const toI128 = (n) => nativeToScVal(BigInt(n), { type: 'i128' });

// u32 (correction_count, delta de reputación)
const toU32 = (n) => nativeToScVal(n, { type: 'u32' });

// Symbol (category)
const toSymbol = (str) => xdr.ScVal.scvSymbol(str);

// BytesN<32> (entry_hash, delivery_hash)
const toBytes32 = (hexString) => {
  const bytes = Buffer.from(hexString, 'hex');
  if (bytes.length !== 32) throw new Error('Hash must be 32 bytes');
  return xdr.ScVal.scvBytes(bytes);
};

// bool (favor_freelancer)
const toBool = (b) => xdr.ScVal.scvBool(b);

// Vec<Address> (winners)
const toAddressVec = (pubkeys) =>
  xdr.ScVal.scvVec(pubkeys.map(pk => new Address(pk).toScVal()));

module.exports = { toAddress, toU64, toI128, toU32, toSymbol, toBytes32, toBool, toAddressVec };
```

---

## ReputationLedger

### `initialize`

```js
// Solo se ejecuta una vez al desplegar. No llamar desde rutas de usuario.
const { Keypair } = require('@stellar/stellar-sdk');
const { invokeContract } = require('./soroban.helper');
const { CONTRACT_IDS } = require('./soroban.client');
const { toAddress } = require('./scval.helpers');

async function initializeReputation(adminKeypair) {
  return invokeContract(
    CONTRACT_IDS.reputation,
    'initialize',
    [toAddress(adminKeypair.publicKey())],
    adminKeypair
  );
}
```

### `add_reputation`

```js
async function addReputation(adminKeypair, userPublicKey, category, delta) {
  return invokeContract(
    CONTRACT_IDS.reputation,
    'add_reputation',
    [
      toAddress(adminKeypair.publicKey()), // caller (admin)
      toAddress(userPublicKey),
      toSymbol(category),
      toU32(delta),
    ],
    adminKeypair
  );
}
```

### `get_reputation` (lectura)

```js
async function getReputation(callerPublicKey, userPublicKey, category) {
  const result = await queryContract(
    CONTRACT_IDS.reputation,
    'get_reputation',
    [toAddress(userPublicKey), toSymbol(category)],
    callerPublicKey
  );

  // El resultado es un ScVal u32
  return result ? Number(result.u32()) : 0;
}
```

### `is_banned` (lectura)

```js
async function isBanned(callerPublicKey, userPublicKey) {
  const result = await queryContract(
    CONTRACT_IDS.reputation,
    'is_banned',
    [toAddress(userPublicKey)],
    callerPublicKey
  );

  return result?.b() ?? false;
}
```

---

## EventContract

### `create_event`

El reclutador debe tener fondos suficientes en el token configurado. El `prize` se transfiere al escrow del contrato.

```js
// routes/events.js
const router = require('express').Router();
const { Keypair } = require('@stellar/stellar-sdk');
const { invokeContract } = require('../soroban.helper');
const { CONTRACT_IDS } = require('../soroban.client');
const { toAddress, toI128, toSymbol, toU64 } = require('../scval.helpers');

router.post('/events', async (req, res) => {
  try {
    const {
      recruiterSecret,   // clave privada del reclutador
      prize,             // entero en stroops o unidades del token
      category,          // string, ej: "design"
      deadlineSubmit,    // unix timestamp
      deadlineSelect,    // unix timestamp
    } = req.body;

    const recruiterKeypair = Keypair.fromSecret(recruiterSecret);

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

    // El valor de retorno es el event_id (u64)
    const eventId = response.returnValue?.u64()?.toString();
    res.json({ success: true, eventId });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `apply_to_event`

```js
router.post('/events/:eventId/apply', async (req, res) => {
  try {
    const { freelancerSecret } = req.body;
    const freelancerKeypair = Keypair.fromSecret(freelancerSecret);

    await invokeContract(
      CONTRACT_IDS.event,
      'apply_to_event',
      [
        toU64(req.params.eventId),
        toAddress(freelancerKeypair.publicKey()),
      ],
      freelancerKeypair
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `submit_entry`

El `entryHash` debe ser el SHA-256 del entregable, representado como hex de 64 caracteres (32 bytes).

```js
const crypto = require('crypto');

router.post('/events/:eventId/submit', async (req, res) => {
  try {
    const { freelancerSecret, entryContent } = req.body;
    const freelancerKeypair = Keypair.fromSecret(freelancerSecret);

    // Calcular hash del entregable en el backend
    const entryHash = crypto.createHash('sha256').update(entryContent).digest('hex');

    await invokeContract(
      CONTRACT_IDS.event,
      'submit_entry',
      [
        toU64(req.params.eventId),
        toAddress(freelancerKeypair.publicKey()),
        toBytes32(entryHash),
      ],
      freelancerKeypair
    );

    res.json({ success: true, entryHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `select_winners`

```js
router.post('/events/:eventId/winners', async (req, res) => {
  try {
    const { recruiterSecret, winners } = req.body;
    // winners: string[] con las public keys de los ganadores

    const recruiterKeypair = Keypair.fromSecret(recruiterSecret);

    await invokeContract(
      CONTRACT_IDS.event,
      'select_winners',
      [
        toU64(req.params.eventId),
        toAddressVec(winners),
      ],
      recruiterKeypair
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `timeout_distribute`

Puede ser llamado por cualquier cuenta. Se recomienda usar la wallet de servicio de la plataforma.

```js
router.post('/events/:eventId/timeout', async (req, res) => {
  try {
    const platformKeypair = Keypair.fromSecret(process.env.PLATFORM_SECRET);

    await invokeContract(
      CONTRACT_IDS.event,
      'timeout_distribute',
      [toU64(req.params.eventId)],
      platformKeypair
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `get_event` (lectura)

```js
router.get('/events/:eventId', async (req, res) => {
  try {
    const platformPublicKey = Keypair.fromSecret(process.env.PLATFORM_SECRET).publicKey();

    const result = await queryContract(
      CONTRACT_IDS.event,
      'get_event',
      [toU64(req.params.eventId)],
      platformPublicKey
    );

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## ProjectContract

### `create_project`

```js
// routes/projects.js
router.post('/projects', async (req, res) => {
  try {
    const {
      recruiterSecret,
      freelancerPublicKey,
      amount,
      guarantee,
      deadline,
      category,
    } = req.body;

    const recruiterKeypair = Keypair.fromSecret(recruiterSecret);

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

    const projectId = response.returnValue?.u64()?.toString();
    res.json({ success: true, projectId });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `accept_project`

```js
router.post('/projects/:projectId/accept', async (req, res) => {
  try {
    const { freelancerSecret } = req.body;
    const freelancerKeypair = Keypair.fromSecret(freelancerSecret);

    await invokeContract(
      CONTRACT_IDS.project,
      'accept_project',
      [
        toU64(req.params.projectId),
        toAddress(freelancerKeypair.publicKey()),
      ],
      freelancerKeypair
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `submit_delivery`

```js
router.post('/projects/:projectId/deliver', async (req, res) => {
  try {
    const { freelancerSecret, deliveryContent } = req.body;
    const freelancerKeypair = Keypair.fromSecret(freelancerSecret);

    const deliveryHash = crypto.createHash('sha256').update(deliveryContent).digest('hex');

    await invokeContract(
      CONTRACT_IDS.project,
      'submit_delivery',
      [
        toU64(req.params.projectId),
        toAddress(freelancerKeypair.publicKey()),
        toBytes32(deliveryHash),
      ],
      freelancerKeypair
    );

    res.json({ success: true, deliveryHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `approve_delivery`

```js
router.post('/projects/:projectId/approve', async (req, res) => {
  try {
    const { recruiterSecret } = req.body;
    const recruiterKeypair = Keypair.fromSecret(recruiterSecret);

    await invokeContract(
      CONTRACT_IDS.project,
      'approve_delivery',
      [
        toU64(req.params.projectId),
        toAddress(recruiterKeypair.publicKey()),
      ],
      recruiterKeypair
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `request_correction`

```js
router.post('/projects/:projectId/correction', async (req, res) => {
  try {
    const { recruiterSecret } = req.body;
    const recruiterKeypair = Keypair.fromSecret(recruiterSecret);

    await invokeContract(
      CONTRACT_IDS.project,
      'request_correction',
      [
        toU64(req.params.projectId),
        toAddress(recruiterKeypair.publicKey()),
      ],
      recruiterKeypair
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `reject_delivery`

```js
router.post('/projects/:projectId/reject', async (req, res) => {
  try {
    const { recruiterSecret } = req.body;
    const recruiterKeypair = Keypair.fromSecret(recruiterSecret);

    await invokeContract(
      CONTRACT_IDS.project,
      'reject_delivery',
      [
        toU64(req.params.projectId),
        toAddress(recruiterKeypair.publicKey()),
      ],
      recruiterKeypair
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `resolve_dispute`

Solo puede ser invocado por la wallet admin de la plataforma.

```js
router.post('/projects/:projectId/resolve', async (req, res) => {
  try {
    const { favorFreelancer } = req.body; // boolean

    const adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET);

    await invokeContract(
      CONTRACT_IDS.project,
      'resolve_dispute',
      [
        toU64(req.params.projectId),
        toAddress(adminKeypair.publicKey()),
        toBool(favorFreelancer),
      ],
      adminKeypair
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### `timeout_approve` y `timeout_refund`

Ambos pueden ser disparados por cualquier cuenta. Se recomienda un job periódico (cron) en el backend:

```js
// jobs/timeout.job.js
const cron = require('node-cron');
const { Keypair } = require('@stellar/stellar-sdk');
const { invokeContract } = require('../soroban.helper');
const { CONTRACT_IDS } = require('../soroban.client');
const { toU64 } = require('../scval.helpers');

// Ejecutar cada 10 minutos
cron.schedule('*/10 * * * *', async () => {
  const platformKeypair = Keypair.fromSecret(process.env.PLATFORM_SECRET);

  // Obtener project_ids vencidos desde tu base de datos
  const expiredDelivered  = await db.getExpiredProjects('Delivered');
  const expiredCreated    = await db.getExpiredProjects('Created');
  const expiredCorrecting = await db.getExpiredProjects('Correcting');

  for (const id of expiredDelivered) {
    await invokeContract(CONTRACT_IDS.project, 'timeout_approve', [toU64(id)], platformKeypair)
      .catch(err => console.error(`timeout_approve ${id}:`, err.message));
  }

  for (const id of [...expiredCreated, ...expiredCorrecting]) {
    await invokeContract(CONTRACT_IDS.project, 'timeout_refund', [toU64(id)], platformKeypair)
      .catch(err => console.error(`timeout_refund ${id}:`, err.message));
  }
});
```

### `get_project` (lectura)

```js
router.get('/projects/:projectId', async (req, res) => {
  try {
    const platformPublicKey = Keypair.fromSecret(process.env.PLATFORM_SECRET).publicKey();

    const result = await queryContract(
      CONTRACT_IDS.project,
      'get_project',
      [toU64(req.params.projectId)],
      platformPublicKey
    );

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## Variables de entorno requeridas

```env
# Red
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NETWORK=testnet

# Contratos desplegados
REPUTATION_CONTRACT_ID=C...
EVENT_CONTRACT_ID=C...
PROJECT_CONTRACT_ID=C...

# Wallets del servidor
ADMIN_SECRET=S...       # Admin del sistema (resolve_dispute, reputación)
PLATFORM_SECRET=S...    # Wallet de servicio (timeouts, queries)
```

> **Nunca** expongas `ADMIN_SECRET` ni `PLATFORM_SECRET` en el frontend ni en logs.

---

## Patrón recomendado en producción: firma en el cliente

Los ejemplos anteriores asumen que el backend recibe la clave privada del usuario, lo cual es válido solo en entornos controlados o scripts internos. En una app de producción el flujo correcto es:

1. El backend construye y simula la transacción, retorna el XDR sin firmar.
2. El frontend firma el XDR con la wallet del usuario (Freighter, Albedo, etc.).
3. El frontend envía el XDR firmado al backend (o directamente a la RPC).

```js
// Endpoint para construir transacción sin firmar
router.post('/transactions/build', async (req, res) => {
  try {
    const { contractId, method, args, callerPublicKey } = req.body;

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

    if (SorobanRpc.Api.isSimulationError(simResult)) {
      return res.status(400).json({ error: simResult.error });
    }

    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();

    // Retornar XDR para que el cliente lo firme con su wallet
    res.json({ xdr: preparedTx.toXDR() });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para enviar una transacción ya firmada por el cliente
router.post('/transactions/submit', async (req, res) => {
  try {
    const { signedXdr } = req.body;
    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

    const sendResult = await server.sendTransaction(tx);

    if (sendResult.status === 'ERROR') {
      return res.status(400).json({ error: sendResult.errorResult });
    }

    res.json({ hash: sendResult.hash, status: sendResult.status });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```