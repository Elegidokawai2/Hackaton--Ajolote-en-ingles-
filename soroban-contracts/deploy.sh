#!/bin/bash
set -e

echo "==> Compilando contratos..."
stellar contract build

echo "==> Desplegando ReputationLedger..."
REPUTATION_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/reputation_ledger.wasm \
  --source admin \
  --network testnet)
echo "ReputationLedger: $REPUTATION_ID"

echo "==> Desplegando EventContract..."
EVENT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/event_contract.wasm \
  --source admin \
  --network testnet)
echo "EventContract: $EVENT_ID"

echo "==> Desplegando ProjectContract..."
PROJECT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/project_contract.wasm \
  --source admin \
  --network testnet)
echo "ProjectContract: $PROJECT_ID"

ADMIN_ADDR=$(stellar keys address admin)
PLATFORM_ADDR=$(stellar keys address platform)
XLM_TOKEN=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

echo "==> Inicializando ReputationLedger..."
stellar contract invoke --id $REPUTATION_ID --source admin --network testnet \
  -- initialize --admin $ADMIN_ADDR

echo "==> Inicializando EventContract..."
stellar contract invoke --id $EVENT_ID --source admin --network testnet \
  -- initialize \
  --admin $ADMIN_ADDR \
  --token $XLM_TOKEN \
  --reputation_addr $REPUTATION_ID \
  --platform_addr $PLATFORM_ADDR

echo "==> Inicializando ProjectContract..."
stellar contract invoke --id $PROJECT_ID --source admin --network testnet \
  -- initialize \
  --admin $ADMIN_ADDR \
  --token $XLM_TOKEN \
  --reputation_addr $REPUTATION_ID \
  --platform_addr $PLATFORM_ADDR

echo "==> Autorizando contratos en ReputationLedger..."
stellar contract invoke --id $REPUTATION_ID --source admin --network testnet \
  -- authorize_contract --contract $EVENT_ID

stellar contract invoke --id $REPUTATION_ID --source admin --network testnet \
  -- authorize_contract --contract $PROJECT_ID

echo ""
echo "✅ Deploy completo"
echo "REPUTATION_CONTRACT_ID=$REPUTATION_ID"
echo "EVENT_CONTRACT_ID=$EVENT_ID"
echo "PROJECT_CONTRACT_ID=$PROJECT_ID"

# Escribir .env automáticamente
cat > .env <<EOF
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NETWORK=testnet
REPUTATION_CONTRACT_ID=$REPUTATION_ID
EVENT_CONTRACT_ID=$EVENT_ID
PROJECT_CONTRACT_ID=$PROJECT_ID
ADMIN_SECRET=$(stellar keys show admin)
PLATFORM_SECRET=$(stellar keys show platform)
EOF

echo "📄 .env generado"