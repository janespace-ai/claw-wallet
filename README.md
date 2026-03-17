<p align="center">
  <b>English</b> | <a href="docs/README.zh-CN.md">简体中文</a> | <a href="docs/README.zh-TW.md">繁體中文</a> | <a href="docs/README.ja.md">日本語</a> | <a href="docs/README.ko.md">한국어</a> | <a href="docs/README.es.md">Español</a> | <a href="docs/README.fr.md">Français</a> | <a href="docs/README.de.md">Deutsch</a> | <a href="docs/README.pt.md">Português</a>
</p>

# claw-wallet

**Let your AI Agent hold a real wallet — securely.**

Web3 wallet plugin for [OpenClaw](https://getclaw.sh) AI Agent framework. A locally self-hosted, non-custodial crypto wallet that gives AI agents the ability to manage assets, send transactions, and interact with EVM blockchains — while keeping private keys encrypted and completely isolated from the LLM.

> Private keys never touch the AI model. The Agent operates through Tool APIs that only return addresses and transaction hashes.

---

## Why claw-wallet?

When AI Agents need to operate on-chain (trading, payments, DeFi strategies), they face a fundamental tension: **the model needs to act, but must never see the key**. claw-wallet solves this with a clean separation:

```
┌─────────────────────────────────────────────────────────────┐
│                     Your AI Agent (LLM)                     │
│                                                             │
│  "Send 10 USDC to Alice on Base"                            │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Tool APIs   │───▶│ Policy Engine│───▶│ Keystore     │    │
│  │ (16 tools)  │    │ (limits &    │    │ (AES-256-GCM │    │
│  │             │    │  approvals)  │    │  + scrypt)   │    │
│  └─────────────┘    └──────────────┘    └──────┬───────┘    │
│                                                │            │
│                                         sign & broadcast    │
│                                                │            │
│                                         ┌──────▼───────┐    │
│                                         │  EVM Chain   │    │
│                                         │  Base / ETH  │    │
│                                         └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**The LLM only sees:** wallet address, balances, transaction hashes, policy status.
**The LLM never sees:** private keys, mnemonics, decrypted key material.

---

## Features

- **Non-custodial & local** — Keys encrypted on your machine, zero cloud dependency.
- **Keystore V3 encryption** — AES-256-GCM + scrypt KDF, same standard used by Ethereum clients.
- **Policy engine** — Per-transaction and daily spending limits, address whitelist, manual approval queue. Even if the Agent is compromised via prompt injection, the policy engine blocks unauthorized transactions.
- **Multi-chain EVM** — Base (default, low gas) and Ethereum mainnet. Extensible to any EVM chain.
- **Dual operating mode** — Supervised (human approves) or Autonomous (within limits).
- **Agent contacts** — P2P address book. Agents exchange addresses and resolve names automatically.
- **Balance monitoring** — Background polling for incoming transfers with real-time notifications.
- **Transaction history** — Local cache with full records of all sent/received transactions.
- **16 OpenClaw tools** — Ready-to-register tool definitions for seamless AI Agent integration.

---

## Use Cases

### Scenario 1: Human → Agent → Contract / Institution

You tell your Agent to pay a merchant, mint an NFT, or interact with a DeFi protocol.

```
 You (chat)                    Your Agent                        On-chain
─────────────────────────────────────────────────────────────────────────────
 "Pay 50 USDC to the          wallet_contacts_resolve            Uniswap
  Uniswap treasury             → 0x1a9C...                      Treasury
  on Ethereum"                                                   Contract
                               wallet_send                         │
                                 to: 0x1a9C...                     │
                                 amount: 50                        │
                                 token: USDC                       │
                                 chain: ethereum                   │
                                        │                          │
                               Policy Engine checks:               │
                                 ✓ $50 < $100 per-tx limit         │
                                 ✓ Daily total within $500         │
                                 ✓ 0x1a9C in whitelist             │
                                        │                          │
                               Sign → Broadcast ──────────────────▶│
                                        │                          │
                               Return: tx hash 0xab3f...      ✓ Confirmed
```

**Typical use:** Pay SaaS subscriptions, purchase on-chain services, interact with DeFi protocols, send to exchange deposit addresses. The address whitelist ensures the Agent can only send to pre-approved contracts.

### Scenario 2: Human → Agent → Another Agent

You tell your Agent to pay another AI Agent for a service — the Agents resolve each other's addresses through the contacts system.

```
 You (chat)              Your Agent                   Bob's Agent
──────────────────────────────────────────────────────────────────
 "Send 10 USDC          wallet_contacts_add
  to Bob's agent          name: "bob-agent"
  on Base"                base: 0x742d...
                                │
                         wallet_send
                           to: "bob-agent"     ◄── resolved from contacts
                           amount: 10
                           token: USDC
                           chain: base
                                │
                         Policy ✓ → Sign → Broadcast ──────▶ 0x742d...
                                │                              │
                         tx: 0xef01...                    Bob's monitor
                                                          detects +10 USDC
                                                          notifies Bob's Agent
```

**Typical use:** Agent-to-Agent payments for API calls, data purchases, collaborative task rewards. Contacts make recurring Agent payments as simple as using a name — no need to paste addresses every time.

### Scenario 3: Agent Autonomous Operations

The Agent operates independently — executing trades, paying for services, or rebalancing a portfolio within policy limits. No human in the loop per transaction.

```
 Agent (autonomous mode)                              On-chain
──────────────────────────────────────────────────────────────────
 Detects: ETH price dropped 5%
 Decision: Buy opportunity

 wallet_balance → 500 USDC available
 wallet_estimate_gas → 0.0001 ETH

 wallet_send
   to: 0xDEX_ROUTER         (whitelisted)
   amount: 200
   token: USDC
   chain: base
         │
 Policy Engine:
   ✓ $200 > $100 per-tx limit  ← BLOCKED
   → Queued for approval (id: a3f8...)

 ─── Option A: Raise limits ───
 wallet_policy_set
   perTransactionLimitUsd: 300
   mode: "autonomous"

 Re-send → Policy ✓ → Sign → Broadcast → Confirmed

 ─── Option B: Human approves ───
 wallet_approval_approve("a3f8...")
 → Sign → Broadcast → Confirmed
```

**Typical use:** DeFi yield farming, automated trading strategies, recurring subscription payments, portfolio rebalancing. The policy engine acts as a **safety rail** — even fully autonomous Agents operate within configurable spending boundaries.

### Mode Comparison

| | Supervised Mode | Autonomous Mode |
|---|---|---|
| **Who decides** | Human approves each non-whitelisted tx | Agent decides within limits |
| **Whitelist required** | Yes — non-whitelisted addresses are blocked | No — any address within limits |
| **Spending limits** | Per-tx + daily limits enforced | Per-tx + daily limits enforced |
| **Best for** | High-value wallets, early trust-building | Routine operations, trading bots |
| **If limits exceeded** | Queued → human approves/rejects | Queued → human approves/rejects |

---

## Quick Start

### Install

```bash
npm install claw-wallet
```

### Basic Usage

```typescript
import { ClawWallet } from "claw-wallet";

const wallet = new ClawWallet({
  defaultChain: "base",
  password: process.env.WALLET_PASSWORD,
});

await wallet.initialize();

// Register all 16 tools with your OpenClaw Agent
const tools = wallet.getTools();

// ... Agent runs, uses tools to send/receive/manage ...

// Clean shutdown: saves history, contacts, policy to disk
await wallet.shutdown();
```

---

## How It Works

### Transaction Flow

A complete transaction from Agent intent to on-chain confirmation:

```
  Agent says: "Send 0.5 ETH to Bob on Base"
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  1. Input Validation                │  Address format, amount range,
  │     validateAddress / validateAmount │  chain whitelist, token symbol
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  2. Recipient Resolution            │  "Bob" → contacts lookup
  │     Contact name or 0x address      │  → 0x742d...4a (on Base)
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  3. Balance Check                   │  ETH balance ≥ amount + gas?
  │     getBalance + estimateGas        │  ERC-20: token balance + ETH for gas
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  4. Policy Check                    │  ✓ Within per-tx limit ($100)?
  │     PolicyEngine.checkTransaction   │  ✓ Within daily limit ($500)?
  │                                     │  ✓ Address whitelisted (supervised)?
  │                                     │
  │     Blocked? → Queue for approval   │  → approval ID returned
  │     Allowed? → Continue ↓           │
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  5. Sign Transaction                │  Decrypt key (scrypt + AES-256-GCM)
  │     Keystore → decrypt → sign       │  Sign tx with viem
  │     → immediately clear key buffer  │  Zero key from memory in finally{}
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  6. Broadcast & Confirm             │  Send raw tx to RPC
  │     broadcastTransaction            │  Wait for receipt
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  7. Record & Return                 │  Save to local history
  │     TransactionHistory.addRecord    │  Return: { hash, status, gasUsed }
  └─────────────────────────────────────┘
```

### Approval Flow (Supervised Mode)

When a transaction exceeds limits or the target address is not whitelisted:

```
  Agent → wallet_send → Policy blocks → approval ID returned
                                              │
              ┌───────────────────────────────┘
              ▼
  Human reviews:  wallet_approval_list  →  see pending tx details
                  wallet_approval_approve(id)  →  tx executes
                  wallet_approval_reject(id)   →  tx cancelled
                  (auto-expires after 24h if no action)
```

---

## Available Tools

claw-wallet exposes 16 tools that the Agent can call:

| Tool | Description |
|------|-------------|
| **Wallet Management** | |
| `wallet_create` | Create a new wallet with encrypted keystore |
| `wallet_import` | Import existing wallet via private key |
| `wallet_address` | Get current wallet address (no decryption needed) |
| **Balance & Gas** | |
| `wallet_balance` | Query ETH or ERC-20 token balance |
| `wallet_estimate_gas` | Estimate gas cost before sending |
| **Transactions** | |
| `wallet_send` | Send ETH or ERC-20 tokens (supports contact names) |
| `wallet_history` | Query paginated transaction history |
| **Contacts** | |
| `wallet_contacts_add` | Add or update a contact with multi-chain addresses |
| `wallet_contacts_list` | List all saved contacts |
| `wallet_contacts_resolve` | Look up a contact's address by name |
| `wallet_contacts_remove` | Remove a contact |
| **Policy & Approvals** | |
| `wallet_policy_get` | View current security policy |
| `wallet_policy_set` | Update spending limits, whitelist, or mode |
| `wallet_approval_list` | List pending transaction approvals |
| `wallet_approval_approve` | Approve a queued transaction |
| `wallet_approval_reject` | Reject a queued transaction |

---

## Security Model

claw-wallet is designed with a **defense-in-depth** approach — multiple independent security layers ensure that no single point of failure can lead to key compromise or unauthorized transfers.

### 1. Key Isolation — Keys Never Touch the LLM

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │   claw-wallet      │
│                    │  addresses, hashes │                    │
│  NO access to:     │                   │  Private key only  │
│  - private keys    │                   │  decrypted inside  │
│  - keystore file   │                   │  signTransaction() │
│  - password        │                   │  then zeroed       │
└────────────────────┘                   └────────────────────┘
```

The Agent interacts exclusively through Tool APIs. No tool ever returns key material. Even `wallet_create` returns only the address.

### 2. Encryption at Rest — Keystore V3

| Component | Detail |
|-----------|--------|
| **Cipher** | AES-256-GCM (authenticated encryption) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **Salt** | 32 bytes random per encryption |
| **IV** | 16 bytes random per encryption |
| **Auth Tag** | GCM tag prevents ciphertext tampering |
| **File Permissions** | 0600 (owner read/write only) |

The private key is encrypted with the user's password through scrypt key derivation, then AES-256-GCM. Each encryption generates fresh random salt and IV, so the same key + password produces different ciphertexts every time.

### 3. Memory Safety

- Private keys are decrypted only during `signTransaction()` / `signMessage()`.
- Key buffers are zeroed with `Buffer.fill(0)` in `finally` blocks — even if signing throws.
- Decrypted key material exists in memory for milliseconds, not seconds.

### 4. Policy Engine — Independent Spending Controls

The policy engine runs **before** any signing occurs and cannot be bypassed through prompt injection:

| Control | Default | Description |
|---------|---------|-------------|
| Per-transaction limit | $100 | Max single transaction amount |
| Daily limit | $500 | Rolling 24h cumulative spending cap |
| Address whitelist | Empty | Required in supervised mode |
| Operating mode | Supervised | `supervised` (whitelist required) or `autonomous` (limits only) |
| Approval queue | 24h expiry | Blocked transactions queue for manual review |

**Anti-bypass measures:**
- All USD amounts use **integer cent arithmetic** (multiply by 100, round) to prevent floating-point precision attacks (e.g., many $0.51 transactions that exploit rounding).
- Whitelist matching is **case-insensitive** to prevent mixed-case address bypass.
- Approval IDs are **cryptographic random** (8 bytes hex) — non-sequential, non-guessable.

### 5. Input Validation — Every Boundary is Guarded

| Input | Validation |
|-------|-----------|
| Address | Hex format, length=42, EIP-55 checksum via viem |
| Amount | Rejects NaN, Infinity, negative, zero, empty |
| Chain | Strict whitelist (`base`, `ethereum`) |
| Token symbol | Max 20 chars, rejects `<>"'\`/\` injection chars |
| Contact name | Max 100 chars, rejects path traversal (`..`, `/`, `\`) |
| Keystore JSON | Full V3 structure + KDF param bounds (n ≤ 2²⁰) |

### 6. File System Security

- **Atomic writes**: write to temp file → rename (prevents corruption on crash).
- **0600 permissions**: only the owner can read/write keystore, contacts, history, policy files.
- **Path traversal prevention**: `sanitizePath()` resolves and rejects paths outside the data directory.

### 7. RPC Safety

- **Negative balance clamping**: treats negative RPC responses as 0.
- **Gas sanity checks**: rejects 0 gas and > 30M gas estimates.
- **No key leakage**: error messages never contain private keys or passwords.

---

## Configuration

```typescript
const wallet = new ClawWallet({
  // Data directory (default: ~/.openclaw/wallet)
  dataDir: "~/.openclaw/wallet",

  // Default chain (default: "base")
  defaultChain: "base",

  // Custom RPC endpoints (optional)
  chains: {
    base: { rpcUrl: "https://your-base-rpc.com" },
    ethereum: { rpcUrl: "https://your-eth-rpc.com" },
  },

  // Master password (or set via wallet.setPassword())
  password: process.env.WALLET_PASSWORD,

  // Balance monitor poll interval (default: 30s)
  pollIntervalMs: 30_000,

  // Callback for incoming transfer notifications
  onBalanceChange: (event) => {
    console.log(`${event.direction}: ${event.difference} ${event.token} on ${event.chain}`);
  },
});
```

---

## Data Storage

All data is stored locally (never sent to the cloud):

```
~/.openclaw/wallet/
├── keystore.json    # Encrypted private key (Keystore V3, chmod 0600)
├── contacts.json    # Agent contacts address book
├── history.json     # Transaction history cache
└── policy.json      # Security policy & approval queue
```

---

## Supported Chains & Tokens

| Chain | Chain ID | Default RPC | Built-in Tokens |
|-------|----------|-------------|-----------------|
| Base | 8453 | Public Base RPC | USDC, USDT |
| Ethereum | 1 | Public Ethereum RPC | USDC, USDT |

Any ERC-20 token can be used by passing its contract address directly. Chains are extensible — add any EVM-compatible chain through configuration.

---

## Architecture

```
src/
├── index.ts          ClawWallet class — orchestrates all subsystems
├── types.ts          Shared TypeScript types & interfaces
├── keystore.ts       Key generation, encrypt/decrypt (AES-256-GCM + scrypt), signing
├── chain.ts          Multi-chain blockchain adapter (viem PublicClient)
├── transfer.ts       Transaction building: validation → policy → sign → broadcast
├── policy.ts         Spending limits, whitelist, approval queue, integer cent math
├── contacts.ts       Named address book with multi-chain resolution
├── history.ts        Local transaction history with BigInt serialization
├── monitor.ts        Background balance polling & change detection
├── validation.ts     Input sanitization, secure file I/O, path traversal prevention
└── tools/            16 OpenClaw tool definitions
    ├── wallet-create.ts
    ├── wallet-import.ts
    ├── wallet-balance.ts       (balance + address + estimate_gas)
    ├── wallet-send.ts
    ├── wallet-contacts.ts      (list + add + resolve + remove)
    ├── wallet-policy.ts        (get + set)
    ├── wallet-approval.ts      (list + approve + reject)
    └── wallet-history.ts
```

**Dependency philosophy:** Minimal. Only [viem](https://viem.sh) for blockchain interaction. All cryptography uses Node.js built-in `node:crypto` (scrypt, AES-256-GCM, randomBytes) — no third-party crypto libraries.

---

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type checking
npm run typecheck

# Build (outputs ESM + CJS + .d.ts)
npm run build

# Development with watch mode
npm run dev
```

### Test Suite

The project includes comprehensive functional and security tests:

| Category | What's Tested |
|----------|---------------|
| **Keystore** | Key generation, encrypt/decrypt, wrong password, V3 structure, persistence |
| **Chain** | Client creation, caching, chain IDs, ERC-20 calldata encoding |
| **Contacts** | CRUD operations, multi-chain resolution, case-insensitive lookup, persistence |
| **History** | Record management, pagination, BigInt serialization |
| **Policy** | Limits, whitelist, modes, approval workflow, persistence |
| **E2E** | Full lifecycle from wallet creation through all 16 tools |
| **Security: Keystore** | Key entropy, random IV/salt, tamper detection, memory clearing, KDF DoS prevention, brute-force resistance (≥100ms decrypt) |
| **Security: Input** | Address/amount/token/contact injection, malicious keystore schemas |
| **Security: Policy** | Float precision attacks, integer cent accuracy, approval ID uniqueness, concurrent daily enforcement |
| **Security: File System** | File permissions (0600), path traversal prevention, atomic writes |
| **Security: RPC** | Balance validation, gas range checks, no key leakage in errors |

---

## Requirements

- Node.js ≥ 18
- An OpenClaw-compatible AI Agent framework (or any framework that supports tool definitions)

---

## License

MIT
