# ProofWork

> **Trustless freelance marketplace powered by Stellar & Soroban**

---

## The Problem

The freelance economy in Latin America is broken by a fundamental trust gap:

- **Freelancers** deliver work and get ghosted, face delayed payments, or receive no payment at all. Their skills and track record are locked inside closed platforms — invisible the moment they leave.
- **Recruiters** hire based on unverifiable ratings. Any platform can fake a 5-star score, and there is no way to confirm a freelancer genuinely completed real work.
- **Payments** go through intermediaries (PayPal, Stripe, bank transfers) that take large fees, block accounts arbitrarily, and cannot guarantee delivery-linked release.

There is no neutral third party that both sides can trust — until now.

---

## What ProofWork Solves

ProofWork is a decentralized freelance marketplace where:

1. **Payment is guaranteed by code, not promises.** Funds are locked on-chain the moment a contract is created. No one can move them until the conditions are met.
2. **Reputation is owned by the freelancer, not the platform.** Every completed project and won event adds points to an immutable on-chain score tied to the freelancer's Stellar wallet — portable across any future platform that reads it.
3. **Competition drives quality.** Open events allow multiple freelancers to submit work for a prize pool. The best submission wins and gets paid automatically. Recruiters get better output; freelancers get fair, merit-based compensation.

---

## How Stellar & Soroban Power the Business Logic

Stellar and Soroban are not cosmetic — they are the trust layer that makes ProofWork's guarantees enforceable.

### 1. XLM Escrow — Payment Custody

When a recruiter creates an **event** or a **1:1 project**, the prize/payment amount is transferred in XLM from their Stellar wallet to the **platform's custodial account** via a native Stellar payment transaction. The funds are held until:

- A winner is selected (events) → XLM is sent from platform to winner's wallet.
- A delivery is approved (projects) → XLM is released to the freelancer's wallet.
- A timeout expires → XLM is refunded to the recruiter.

Every transfer is a real on-chain Stellar transaction with a hash, fully auditable on [Stellar Expert](https://stellar.expert).

### 2. Soroban Smart Contracts — On-Chain Reputation

Four Soroban contracts handle the core logic on **Stellar Testnet**:

| Contract | Purpose |
|---|---|
| `reputation_ledger` | Stores per-user, per-category reputation scores. Incremented on event wins and project completions. Read by any external observer. |
| `event_contract` | Manages event lifecycle: registration, submission validation, winner selection, and prize escrow logic. |
| `project_contract` | Handles 1:1 project flow: accept, deliver, approve/reject, and timeout resolution. |
| `wallet_registry` | Associates Stellar public keys with platform user identities. |

The reputation score is **append-only and non-custodial** — once written to the Soroban ledger, neither the platform nor the recruiter can alter or erase a freelancer's history.

### 3. Custodial Wallets — Frictionless Onboarding

To lower the barrier to entry, ProofWork generates a **Stellar keypair** for every new user at registration. The private key is AES-256-CBC encrypted and stored server-side. This means users don't need a browser extension or prior crypto knowledge — they interact with XLM natively through the app UI. Power users can export and self-custody their keys at any time.

### 4. On-Chain Reputation as a Search Filter

The `SearchIndexFreelancers` collection aggregates on-chain reputation scores by category. Recruiters can filter the freelancer marketplace by:

- Category (Software, Marketing, Design, Video, Photography)
- Minimum reputation score

This directly ties blockchain state to product discovery — the better you perform on-chain, the more visible you are to potential clients.

---

## Business Model

| Revenue Stream | Mechanism |
|---|---|
| Platform Commission | 10% fee deducted from every prize/project payout at release time |
| Premium Listings | Future: featured event placement for higher visibility |
| Reputation API | Future: expose verified reputation scores to third-party platforms via API |

The commission is enforced at the smart contract/payment layer — it cannot be bypassed.

---

## Feature Overview

- 🏆 **Competitive Events** — Open challenges with XLM prize pools; multiple freelancers submit, best wins
- 🤝 **1:1 Private Projects** — Direct contracts with escrow, delivery workflow, and dispute flow
- 🔍 **Freelancer Marketplace** — Browse and filter freelancers by category and on-chain reputation level (Bronze → Diamond)
- 💬 **In-App Chat** — Per-project messaging between recruiter and freelancer
- 🪙 **Stellar Wallet** — Auto-generated custodial wallet, real XLM balance visible from Horizon API
- 📊 **On-Chain Reputation Badges** — Bronze / Silver / Gold / Platinum / Diamond per category

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│              Next.js 14 · React · Tailwind CSS              │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────────┐
│                         Backend                             │
│            Node.js · Express · MongoDB (Mongoose)           │
│                                                             │
│  Auth · Users · Events · Projects · Reputation · Wallets   │
└──────────────┬─────────────────────────────┬────────────────┘
               │ Stellar SDK                 │ Soroban RPC
┌──────────────▼──────────────┐  ┌──────────▼───────────────┐
│    Stellar Horizon (Testnet) │  │  Soroban Smart Contracts  │
│    XLM Payments & Escrow     │  │  reputation_ledger        │
│    Account Balances          │  │  event_contract           │
│                              │  │  project_contract         │
│                              │  │  wallet_registry          │
└──────────────────────────────┘  └──────────────────────────┘
```

### Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, Tailwind CSS, Zustand |
| Backend | Node.js, Express, MongoDB, Mongoose |
| Blockchain | Stellar SDK (`@stellar/stellar-sdk`), Soroban RPC |
| Smart Contracts | Rust (Soroban SDK) |
| Auth | JWT + HTTP-only refresh cookies |
| Wallet Encryption | AES-256-CBC |

---

## Smart Contracts

Located in `/soroban-contracts/contracts/`:

```
soroban-contracts/
├── contracts/
│   ├── reputation_ledger/   # Per-category reputation scores
│   ├── event_contract/      # Event lifecycle & prize escrow
│   ├── project_contract/    # 1:1 project workflow
│   └── wallet_registry/     # User ↔ Stellar key association
├── deploy.sh                # Testnet deployment script
└── Cargo.toml
```

---

## Local Setup

### Prerequisites

- Node.js ≥ 18
- MongoDB (local or Atlas)
- Stellar Testnet account funded via [Friendbot](https://friendbot.stellar.org)

### Backend

```bash
cd backend
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, PLATFORM_SECRET, etc.
npm install
npm run dev            # runs on :5001
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # runs on :3000
```

### Seed Initial Data

After starting the backend, seed the 5 platform categories:

```bash
curl -X POST http://localhost:5001/api/admin/seed-categories
```

### Environment Variables (Backend)

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `PLATFORM_SECRET` | Stellar secret key for the platform escrow account |
| `ADMIN_SECRET` | Admin Stellar secret (can be same as platform for testnet) |
| `WALLET_ENCRYPTION_KEY` | 32-byte hex key for AES wallet encryption |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint (testnet) |
| `REPUTATION_CONTRACT_ID` | Deployed `reputation_ledger` contract ID |

---

## Team

Built for the **Stellar / Soroban Hackathon** — ProofWork team.

