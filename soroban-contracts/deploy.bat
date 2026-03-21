@echo off
setlocal enabledelayedexpansion

echo ==========================================================
echo   ProofWork - Deploy de contratos a Stellar Testnet
echo ==========================================================
echo.

REM ── Verificar que stellar CLI está instalado ───────────────
where stellar >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] stellar-cli no encontrado.
    echo Instala con: cargo install --locked stellar-cli --features opt
    pause
    exit /b 1
)

REM ── Compilar contratos ─────────────────────────────────────
echo [1/6] Compilando contratos...
stellar contract build
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al compilar los contratos.
    pause
    exit /b 1
)
echo [OK] Compilacion exitosa.
echo.

REM ── Desplegar ReputationLedger ─────────────────────────────
echo [2/6] Desplegando ReputationLedger...
for /f "delims=" %%i in ('stellar contract deploy --wasm target/wasm32v1-none/release/reputation_ledger.wasm --source admin --network testnet') do set REPUTATION_ID=%%i
if "!REPUTATION_ID!"=="" (
    echo [ERROR] No se pudo desplegar ReputationLedger.
    pause
    exit /b 1
)
echo [OK] ReputationLedger: !REPUTATION_ID!
echo.

REM ── Desplegar EventContract ────────────────────────────────
echo [3/6] Desplegando EventContract...
for /f "delims=" %%i in ('stellar contract deploy --wasm target/wasm32v1-none/release/event_contract.wasm --source admin --network testnet') do set EVENT_ID=%%i
if "!EVENT_ID!"=="" (
    echo [ERROR] No se pudo desplegar EventContract.
    pause
    exit /b 1
)
echo [OK] EventContract: !EVENT_ID!
echo.

REM ── Desplegar ProjectContract ──────────────────────────────
echo [4/6] Desplegando ProjectContract...
for /f "delims=" %%i in ('stellar contract deploy --wasm target/wasm32v1-none/release/project_contract.wasm --source admin --network testnet') do set PROJECT_ID=%%i
if "!PROJECT_ID!"=="" (
    echo [ERROR] No se pudo desplegar ProjectContract.
    pause
    exit /b 1
)
echo [OK] ProjectContract: !PROJECT_ID!
echo.

REM ── Obtener addresses ──────────────────────────────────────
for /f "delims=" %%i in ('stellar keys address admin')    do set ADMIN_ADDR=%%i
for /f "delims=" %%i in ('stellar keys address platform') do set PLATFORM_ADDR=%%i

REM Token XLM nativo en testnet (SAC)
set XLM_TOKEN=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

echo Usando Admin:    !ADMIN_ADDR!
echo Usando Platform: !PLATFORM_ADDR!
echo Usando Token:    !XLM_TOKEN!
echo.

REM ── Inicializar contratos ──────────────────────────────────
echo [5/6] Inicializando contratos...

echo    Inicializando ReputationLedger...
stellar contract invoke --id !REPUTATION_ID! --source admin --network testnet -- initialize --admin !ADMIN_ADDR!
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al inicializar ReputationLedger.
    pause
    exit /b 1
)

echo    Inicializando EventContract...
stellar contract invoke --id !EVENT_ID! --source admin --network testnet -- initialize --admin !ADMIN_ADDR! --token !XLM_TOKEN! --reputation_addr !REPUTATION_ID! --platform_addr !PLATFORM_ADDR!
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al inicializar EventContract.
    pause
    exit /b 1
)

echo    Inicializando ProjectContract...
stellar contract invoke --id !PROJECT_ID! --source admin --network testnet -- initialize --admin !ADMIN_ADDR! --token !XLM_TOKEN! --reputation_addr !REPUTATION_ID! --platform_addr !PLATFORM_ADDR!
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al inicializar ProjectContract.
    pause
    exit /b 1
)
echo [OK] Contratos inicializados.
echo.

REM ── Autorizar contratos en ReputationLedger ────────────────
echo [6/6] Autorizando EventContract y ProjectContract en ReputationLedger...

stellar contract invoke --id !REPUTATION_ID! --source admin --network testnet -- authorize_contract --contract !EVENT_ID!
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al autorizar EventContract.
    pause
    exit /b 1
)

stellar contract invoke --id !REPUTATION_ID! --source admin --network testnet -- authorize_contract --contract !PROJECT_ID!
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al autorizar ProjectContract.
    pause
    exit /b 1
)
echo [OK] Contratos autorizados.
echo.

REM ── Obtener secrets para el .env ───────────────────────────
for /f "delims=" %%i in ('stellar keys show admin')    do set ADMIN_SECRET=%%i
for /f "delims=" %%i in ('stellar keys show platform') do set PLATFORM_SECRET=%%i

REM ── Escribir archivo .env ──────────────────────────────────
echo Generando .env...
(
    echo SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
    echo NETWORK=testnet
    echo REPUTATION_CONTRACT_ID=!REPUTATION_ID!
    echo EVENT_CONTRACT_ID=!EVENT_ID!
    echo PROJECT_CONTRACT_ID=!PROJECT_ID!
    echo ADMIN_SECRET=!ADMIN_SECRET!
    echo PLATFORM_SECRET=!PLATFORM_SECRET!
) > .env
echo [OK] .env generado.
echo.

REM ── Resumen final ──────────────────────────────────────────
echo ==========================================================
echo   Deploy completado exitosamente
echo ==========================================================
echo   REPUTATION_CONTRACT_ID = !REPUTATION_ID!
echo   EVENT_CONTRACT_ID      = !EVENT_ID!
echo   PROJECT_CONTRACT_ID    = !PROJECT_ID!
echo ==========================================================
echo.
echo Puedes verificar los contratos en:
echo https://stellar.expert/explorer/testnet/contract/!REPUTATION_ID!
echo https://stellar.expert/explorer/testnet/contract/!EVENT_ID!
echo https://stellar.expert/explorer/testnet/contract/!PROJECT_ID!
echo.

pause
endlocal
pause
pause
pause