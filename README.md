# NUUP — ProofWork

> Plataforma gamificada de freelancers con **reputación on-chain** sobre la red Stellar.  
> Conecta freelancers y reclutadores a través de eventos de competencia y contratos de trabajo 1:1, con pagos y reputación gestionados por smart contracts Soroban.

---

## Tabla de contenidos

- [Descripción general](#descripción-general)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Variables de entorno](#variables-de-entorno)
- [Instalación y puesta en marcha](#instalación-y-puesta-en-marcha)
  - [1. Backend (Node.js / Express)](#1-backend-nodejs--express)
  - [2. Frontend (Next.js)](#2-frontend-nextjs)
  - [3. Smart Contracts (Soroban / Rust)](#3-smart-contracts-soroban--rust)
- [Arquitectura](#arquitectura)
- [API Reference](#api-reference)
- [Smart Contracts](#smart-contracts)
- [Flujos principales](#flujos-principales)
- [Contribuir](#contribuir)

---

## Descripción general

NUUP es una plataforma **custodial** — el usuario se autentica con email y contraseña; la plataforma gestiona su wallet Stellar internamente. Los pagos se realizan en **MXNe** (token MXN digital sobre Stellar) y la reputación se escribe directamente en la blockchain, funcionando como fuente única de verdad.

Existen dos modos de trabajo:

| Modo | Descripción |
|---|---|
| **Eventos** | Competencia abierta: un reclutador publica un evento con premio en escrow; múltiples freelancers participan; el reclutador elige ganadores. |
| **Proyectos** | Contrato 1:1: un reclutador contrata directamente a un freelancer; el pago queda en escrow hasta la aprobación de la entrega. |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16, React 18, TypeScript, Tailwind CSS |
| Backend | Node.js, Express 5, Mongoose (MongoDB Atlas) |
| Blockchain | Stellar / Soroban (smart contracts en Rust) |
| Auth | JWT + bcrypt |
| State mgmt | Zustand |
| Forms | React Hook Form + Zod |

---

## Estructura del proyecto

```
NUUP/
├── backend/                  # API REST Express + integración Soroban
│   ├── contracts/            # Wrappers JS para interactuar con contratos Soroban
│   ├── controllers/          # Lógica de negocio por módulo
│   ├── jobs/                 # Cron jobs (timeouts de eventos y proyectos)
│   ├── middleware/           # Auth JWT, validación de roles
│   ├── models/               # Esquemas Mongoose (MongoDB)
│   ├── routes/               # Definición de endpoints REST
│   ├── services/             # Servicios reutilizables (wallets, Soroban, etc.)
│   ├── server.js             # Entry point
│   └── .env.example          # Plantilla de variables de entorno
│
├── frontend/                 # Aplicación Next.js
│   ├── src/
│   │   ├── app/              # App Router de Next.js (páginas y layouts)
│   │   ├── components/       # Componentes React reutilizables
│   │   ├── lib/              # Clientes HTTP, utilidades
│   │   ├── store/            # Estado global con Zustand
│   │   └── types/            # Tipos TypeScript compartidos
│   └── package.json
│
└── soroban-contracts/        # Smart contracts en Rust (Soroban SDK)
    ├── contracts/
    │   ├── reputation_ledger/  # Gestión de reputación on-chain
    │   ├── event_contract/     # Eventos/competencias con escrow
    │   ├── project_contract/   # Proyectos 1:1 con escrow
    │   └── wallet_registry/    # Registro de identidad on-chain
    ├── deploy.sh               # Script de compilación y despliegue (Linux/macOS)
    ├── deploy.bat              # Script de despliegue (Windows)
    ├── contract.docs.md        # Documentación detallada de contratos
    ├── backend_endpoints_v2.md # Especificación completa de la API
    └── .env.example            # Plantilla de variables de entorno
```

---

## Requisitos previos

Asegúrate de tener instalado lo siguiente antes de comenzar:

| Herramienta | Versión mínima | Instalación |
|---|---|---|
| **Node.js** | 20 LTS | https://nodejs.org |
| **npm** | 10+ | incluido con Node.js |
| **Rust** | stable | https://rustup.rs |
| **Stellar CLI** | latest | `cargo install --locked stellar-cli --features opt` |
| **MongoDB Atlas** | — | cuenta gratuita en https://cloud.mongodb.com |

> **Nota:** Para trabajar únicamente en el frontend o backend no necesitas instalar Rust ni Stellar CLI. Solo es necesario para compilar y desplegar contratos.

---

## Variables de entorno

El proyecto utiliza variables de entorno en dos módulos. **Nunca subas archivos `.env` reales al repositorio.**

### Backend (`backend/.env`)

Copia la plantilla y rellena tus valores:

```bash
cp backend/.env.example backend/.env
```

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor Express (default: `5000`) |
| `MONGO_URI` | URI de conexión a MongoDB Atlas |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT |
| `SOROBAN_RPC_URL` | RPC de Soroban (`https://soroban-testnet.stellar.org`) |
| `NETWORK` | Red Stellar: `testnet` o `mainnet` |
| `REPUTATION_CONTRACT_ID` | ID del contrato `ReputationLedger` desplegado |
| `EVENT_CONTRACT_ID` | ID del contrato `EventContract` desplegado |
| `PROJECT_CONTRACT_ID` | ID del contrato `ProjectContract` desplegado |
| `WALLET_REGISTRY_CONTRACT_ID` | ID del contrato `WalletRegistry` desplegado |
| `ADMIN_SECRET` | Clave secreta Stellar de la cuenta administradora |
| `PLATFORM_SECRET` | Clave secreta Stellar de la cuenta de plataforma |
| `WALLET_ENCRYPTION_KEY` | Clave de cifrado para wallets custodiales en DB |

### Soroban Contracts (`soroban-contracts/.env`)

```bash
cp soroban-contracts/.env.example soroban-contracts/.env
```

Contiene las mismas variables de Stellar/Soroban que el backend (sin `PORT`, `MONGO_URI`, `JWT_SECRET`).

> **Tip:** Si ya desplegaste los contratos con `deploy.sh`, el script escribe automáticamente el `.env` en `soroban-contracts/`.

---

## Instalación y puesta en marcha

### 1. Backend (Node.js / Express)

```bash
# Instalar dependencias
cd backend
npm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales

# Modo desarrollo (con hot-reload via nodemon)
npm run dev

# Modo producción
npm start
```

El servidor arranca en `http://localhost:5000` (o el puerto definido en `PORT`).

**Verificar que funciona:**
```bash
curl http://localhost:5000/api
# Respuesta esperada: "ProofWork API is running..."
```

---

### 2. Frontend (Next.js)

El frontend corre en el puerto **3001** (configurado en `package.json`).

```bash
# Instalar dependencias
cd frontend
npm install

# Modo desarrollo
npm run dev
```

Abre `http://localhost:3001` en tu navegador.

> **Variables de entorno del frontend:** si el frontend requiere acceso a la URL del backend, crea un archivo `frontend/.env.local` con:
> ```
> NEXT_PUBLIC_API_URL=http://localhost:5000/api
> ```

**Build de producción:**
```bash
npm run build
npm start
```

---

### 3. Smart Contracts (Soroban / Rust)

> Necesitas **Rust** y **Stellar CLI** instalados (ver [Requisitos previos](#requisitos-previos)).

#### Configurar identidades en Stellar CLI

```bash
# Crear cuenta administradora (guarda la clave secreta que muestra)
stellar keys generate admin --network testnet

# Crear cuenta de plataforma
stellar keys generate platform --network testnet

# Fondear cuentas en testnet (Friendbot)
stellar keys fund admin --network testnet
stellar keys fund platform --network testnet
```

#### Compilar contratos

```bash
cd soroban-contracts
stellar contract build
```

Los archivos `.wasm` se generan en `target/wasm32-unknown-unknown/release/`.

#### Desplegar contratos (Linux / macOS)

```bash
# Dar permisos al script
chmod +x deploy.sh

# Ejecutar despliegue completo
./deploy.sh
```

El script compilará, desplegará e inicializará los 4 contratos en testnet y escribirá automáticamente el archivo `.env` con los IDs generados.

#### Desplegar contratos (Windows)

```bat
deploy.bat
```

#### Verificar un contrato desplegado

```bash
stellar contract invoke \
  --id <REPUTATION_CONTRACT_ID> \
  --source admin \
  --network testnet \
  -- get_admin
```

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                  │
│                    http://localhost:3001                  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP REST
┌───────────────────────▼─────────────────────────────────┐
│               Backend API (Express / Node.js)            │
│                    http://localhost:5000                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Controllers  │  │   Services   │  │  Cron Jobs    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                 │                  │           │
│  ┌──────▼───────────────────────────────────▼────────┐  │
│  │           Contract Wrappers (contracts/)           │  │
│  └──────────────────────┬─────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                          │ Soroban RPC
┌─────────────────────────▼───────────────────────────────┐
│              Stellar Testnet (Soroban)                   │
│                                                          │
│  ReputationLedger │ EventContract │ ProjectContract      │
│                   │ WalletRegistry                       │
└─────────────────────────────────────────────────────────┘
                          │
              ┌───────────▼──────────┐
              │    MongoDB Atlas      │
              │  (metadatos off-chain)│
              └──────────────────────┘
```

**Modelo custodial:** El usuario nunca maneja claves privadas. La plataforma almacena las wallets Stellar cifradas en MongoDB y firma las transacciones en nombre del usuario.

---

## API Reference

La especificación completa de endpoints se encuentra en [`soroban-contracts/backend_endpoints_v2.md`](./soroban-contracts/backend_endpoints_v2.md).

### Resumen de módulos

| Prefijo | Descripción |
|---|---|
| `POST /api/auth/register` | Registro de usuario + creación de wallet custodial |
| `POST /api/auth/login` | Autenticación JWT |
| `GET/PATCH /api/users/:publicKey` | Perfil y reputación del usuario |
| `GET/POST /api/events` | Listar y crear eventos/competencias |
| `POST /api/events/:id/apply` | Aplicar a un evento |
| `POST /api/events/:id/submit` | Enviar entregable a un evento |
| `POST /api/events/:id/winners` | Seleccionar ganadores |
| `GET/POST /api/projects` | Listar y crear proyectos 1:1 |
| `POST /api/projects/:id/accept` | Freelancer acepta el proyecto |
| `POST /api/projects/:id/deliver` | Freelancer entrega el trabajo |
| `POST /api/projects/:id/approve` | Reclutador aprueba entrega |
| `GET/POST /api/disputes` | Gestión de disputas (Admin) |
| `GET /api/reputation/:publicKey` | Reputación on-chain de un usuario |
| `GET /api/wallets/balance` | Saldo MXNe del usuario |
| `GET /api/notifications` | Notificaciones del usuario |
| `GET /api/admin/*` | Panel de administración |

---

## Smart Contracts

Documentación detallada en [`soroban-contracts/contract.docs.md`](./soroban-contracts/contract.docs.md).

### Contratos desplegados en Testnet

| Contrato | ID | Descripción |
|---|---|---|
| `ReputationLedger` | Ver `.env` | Fuente única de verdad para reputación on-chain |
| `EventContract` | Ver `.env` | Gestión de competencias con escrow |
| `ProjectContract` | Ver `.env` | Proyectos 1:1 con escrow y ciclo de vida completo |
| `WalletRegistry` | Ver `.env` | Registro de identidad on-chain de usuarios |

### Resumen de contratos

**ReputationLedger** — Almacena puntos de reputación por usuario y categoría. Solo el admin y contratos autorizados pueden modificarla.

**EventContract** — El reclutador deposita un premio en escrow; los freelancers aplican y envían entregables (hash SHA-256); el reclutador selecciona ganadores. Comisión de plataforma: 10%.

**ProjectContract** — Acuerdo bilateral reclutador ↔ freelancer con escrow, hasta 2 rondas de corrección, sistema de disputas resueltas por el admin.

**WalletRegistry** — Registro de wallets custodiales; valida actividad y rol de usuarios en los demás contratos.

---

## Flujos principales

### Flujo de Evento (Competencia)

```
Reclutador → POST /events           → Crea evento + deposita escrow en MXNe
Freelancer → POST /events/:id/apply → Se registra como participante
Freelancer → POST /events/:id/submit → Envía entregable (hash SHA-256)
Reclutador → POST /events/:id/winners → Selecciona ganadores
                                     → Contrato distribuye 90% premio + 10% plataforma
                                     → Reputación: +10 ganadores, +1 participantes
```

### Flujo de Proyecto (1:1)

```
Reclutador → POST /projects              → Crea proyecto + deposita (amount + guarantee)
Freelancer → POST /projects/:id/accept   → Acepta el proyecto
Freelancer → POST /projects/:id/deliver  → Envía entregable
Reclutador → POST /projects/:id/approve  → Aprueba → fondos al freelancer + +5 reputación
          ↪ POST /projects/:id/correction → Solicita corrección (máx. 2 rondas)
          ↪ POST /projects/:id/reject     → Rechaza → abre disputa
Admin      → POST /disputes/:id/resolve  → Resuelve disputa a favor de cualquiera
```

---

## Contribuir

### Primeros pasos para un nuevo contribuidor

1. **Forkea** el repositorio y clónalo localmente.
2. **Crea** tus archivos `.env` a partir de los `.env.example`:
   ```bash
   cp backend/.env.example backend/.env
   cp soroban-contracts/.env.example soroban-contracts/.env
   ```
3. **Rellena** las variables de entorno con tus propias credenciales (MongoDB Atlas gratuito, cuenta Stellar testnet).
4. **Instala** las dependencias de cada módulo:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
5. **Levanta** el backend y el frontend:
   ```bash
   # Terminal 1
   cd backend && npm run dev
   # Terminal 2
   cd frontend && npm run dev
   ```
6. **Lee** la documentación de contratos y endpoints antes de modificar lógica on-chain:
   - [`soroban-contracts/contract.docs.md`](./soroban-contracts/contract.docs.md)
   - [`soroban-contracts/backend_endpoints_v2.md`](./soroban-contracts/backend_endpoints_v2.md)

### Convenciones

- El backend usa **camelCase** para todos los parámetros de body y query.
- Todos los endpoints retornan `{ success: true, data: ... }` en éxito y `{ error: "mensaje" }` en error.
- Los montos de contratos Soroban están en **MXNe** (no XLM).
- Las claves secretas Stellar (`S...`) **NUNCA** deben llegar al cliente; viven únicamente en variables de entorno del servidor.

---

> **Red:** Testnet Stellar | **Token de pago:** MXNe (SAC) | **RPC:** `https://soroban-testnet.stellar.org`
