<p align="center">
  <b>English</b> | <a href="docs/README.zh-CN.md">简体中文</a> | <a href="docs/README.zh-TW.md">繁體中文</a> | <a href="docs/README.ja.md">日本語</a> | <a href="docs/README.ko.md">한국어</a> | <a href="docs/README.es.md">Español</a> | <a href="docs/README.fr.md">Français</a> | <a href="docs/README.de.md">Deutsch</a> | <a href="docs/README.pt.md">Português</a>
</p>

# claw-wallet

> 👤 **Not a developer?** Visit **[janespace-ai.github.io](https://janespace-ai.github.io)** for the user guide — installation, pairing, and getting started in minutes.

**Let your AI Agent hold a real wallet — securely.**

A non-custodial crypto wallet for [OpenClaw](https://getclaw.sh) AI Agents. Private keys live in a separate **Electron Desktop Wallet**, completely isolated from the AI model. The Agent and Desktop communicate through an **E2EE (End-to-End Encrypted)** channel via a **Go Relay Server** — the relay only forwards ciphertext and can never read or tamper with messages.

> Private keys never touch the AI model. Not on the same machine, not in the same process, not in memory. The Agent only sees wallet addresses and transaction hashes.

---

## Architecture

```
┌──────────────┐        E2EE WebSocket        ┌──────────────┐        E2EE WebSocket        ┌──────────────────┐
│  AI Agent    │◄────────────────────────────►│  Go Relay    │◄────────────────────────────►│  Desktop Wallet  │
│  (TypeScript)│   X25519 + AES-256-GCM       │  Server      │   X25519 + AES-256-GCM       │  (Electron)      │
│              │                               │  (Hertz)     │                               │                  │
│ Zero secrets │                               │ Stateless    │                               │ Holds all keys   │
│ Tool APIs    │                               │ WS forwarder │                               │ Signs locally    │
│ JSON-RPC IPC │                               │ IP binding   │                               │ Security monitor │
│ 17 tools     │                               │ Rate limiter │                               │ Lock manager     │
└──────────────┘                               └──────────────┘                               └──────────────────┘
       │                                                                                              │
       │  Agent never sees:                                                        Desktop holds:     │
       │  • private keys                                                           • BIP-39 mnemonic  │
       │  • mnemonics                                                              • Keystore V3 file │
       │  • key material                                                           • Signing engine    │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Three-component design**: Each component has a single responsibility. Even if the Agent's host is fully compromised, the attacker gains zero key material.

---

## 📦 Two Ways to Use

### 🤖 Option 1: Skills (for AI agents — recommended)

One command gives your AI agent full wallet capabilities. Works with OpenClaw, Claude Code, Cline, Cursor, and any `npx skills`-compatible agent.

**Install via CLI:**
```bash
npx skills add janespace-ai/claw-wallet
```

**Or paste directly into your agent chat (OpenClaw):**
```
Install Claw Wallet: https://github.com/janespace-ai/claw-wallet
```

After install, set `RELAY_URL=http://localhost:8080` (default — Claw Wallet desktop app starts the relay automatically on launch).

Then pair once:
```
"Please pair my wallet, the pairing code is XXXXXXXX"
```

**Advantages:**
- ✅ Zero code required
- ✅ One command setup
- ✅ Works with any skills-compatible agent
- ✅ Natural language interaction

See [skills/claw-wallet/SKILL.md](./skills/claw-wallet/SKILL.md) for full tool reference.

### 🔧 Option 2: Direct SDK Integration (for your code)

Install and use directly in your Node.js application:

```bash
npm install claw-wallet
```

```typescript
import { ClawWallet } from 'claw-wallet';

const wallet = new ClawWallet({
  relayUrl: 'http://localhost:8080',
  dataDir: '~/.claw-wallet',
  defaultChain: 'base',
});

await wallet.initialize();
const tools = wallet.getTools();

// Directly call any tool
const pairTool = tools.find(t => t.name === 'wallet_pair');
await pairTool.execute({ shortCode: 'ABC12345' });
```

**Advantages:**
- ✅ Full control over tool calls
- ✅ Direct integration into Node.js apps, scripts, automation
- ✅ Embed in any custom agent framework

See [agent/examples/](./agent/examples/README.md) for complete examples.

---

## User Interaction Flow

### First-Time Setup: Pairing

Only required once. After the initial pairing, reconnection is fully automatic.

```
 You                          Desktop Wallet                 Relay Server              AI Agent
──────────────────────────────────────────────────────────────────────────────────────────────────
 1. Create wallet
    (set password,            Generates BIP-39 mnemonic
     backup mnemonic)         Encrypts with AES-256-GCM
                              + scrypt KDF
                                    │
 2. Click "Generate           Generates 8-char pairing
    Pairing Code"             code (valid 10 min)
                                    │
 3. Copy code to Agent              │                                              Agent calls
    (or send via secure             │                                              wallet_pair
    channel)                        │                                              { shortCode }
                                    │                         ◄──── Agent registers ────┘
                                    │                               with code
                              Desktop connects ────────────►  Relay matches pair
                              X25519 key exchange ◄─────────► E2EE session established
                                    │
                              Saves persistent comm          Agent saves persistent
                              key pair (encrypted)           comm key pair (0600)
                                    │
                              Derives deterministic          Derives same pairId
                              pairId = SHA256(addr +         = SHA256(addr +
                              agentPubKey)[:16]              agentPubKey)[:16]
                                    │
 ✓ Paired!                    Ready to sign                  Ready to transact
```

### Daily Use: Automatic Reconnection

After initial pairing, the Agent and Desktop reconnect automatically on restart — no user action needed.

```
 Agent restarts               Desktop restarts
       │                             │
 Loads persistent             Loads persistent
 comm key pair                comm key pair (decrypts
 from disk                    with wallet password)
       │                             │
 Recomputes pairId            Recomputes same pairId
       │                             │
 Connects to Relay ──────────► Relay routes by pairId ──────► Desktop receives
       │                                                             │
 Sends extended handshake:                                    Three-level verification:
 • publicKey                                                  ✓ Level 1: Public key matches stored key
 • machineId                                                  ✓ Level 2: machineId matches stored ID
 • reconnect: true                                            ✓ Level 3: IP change policy (configurable)
       │                                                             │
 E2EE session restored ◄──────────────────────────────────── Session active
       │                                                             │
 Ready to transact                                            Ready to sign
```

### Transaction Flow

```
 You (chat with Agent)                AI Agent                        Desktop Wallet
──────────────────────────────────────────────────────────────────────────────────────
 "Send 0.5 ETH to Bob           wallet_send
  on Base"                         to: "bob"  (contact)
                                   amount: 0.5
                                   chain: base
                                        │
                                 Resolve contact ──► Bob = 0x742d...
                                 Build tx request
                                        │
                                 E2EE encrypt ──────────────────► Decrypt request
                                                                       │
                                                                 Policy check:
                                                                   ✓ Within per-tx limit
                                                                   ✓ Within daily limit
                                                                   ✓ Device not frozen
                                                                       │
                                                                 Decrypt private key
                                                                 Sign transaction
                                                                 Zero key from memory
                                                                 Broadcast to chain
                                                                       │
                                 Receive result ◄────────────────── tx hash + receipt
                                        │
                                 Return to you:
                                 "Sent 0.5 ETH to Bob
                                  tx: 0xab3f..."
```

---

## Security Architecture

claw-wallet uses **defense-in-depth** with two independent security domains: **communication security** (how components talk) and **key security** (how keys are stored and used).

### Part A: Communication Security

#### 1. End-to-End Encryption (E2EE)

All messages between Agent and Desktop are encrypted end-to-end. The Relay server only sees ciphertext.

| Component | Detail |
|-----------|--------|
| **Key Exchange** | X25519 ECDH (Curve25519) |
| **Key Derivation** | HKDF-SHA256 |
| **Encryption** | AES-256-GCM (authenticated) |
| **Anti-Replay** | Incrementing nonce per message |
| **Forward Secrecy** | New ephemeral keys per session |

#### 2. Automatic Pairing & Reconnection

Manual pairing is only needed once. The system uses **persistent communication key pairs** and **deterministic pair IDs** for automatic reconnection:

- **Persistent Key Pairs**: X25519 key pairs are saved to disk — encrypted with the wallet password on Desktop (scrypt + AES-256-GCM), file-permission-protected (0600) on Agent
- **Deterministic PairId**: `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` — both sides compute the same ID independently, no coordination needed
- **Zero-interaction Reconnect**: On restart, both sides load their stored keys, recompute the pairId, and reconnect through the Relay automatically

#### 3. Three-Level Reconnection Verification

When an Agent reconnects, the Desktop performs three identity checks before allowing any signing:

| Level | Check | Failure Action |
|-------|-------|----------------|
| **Level 1** (Hard) | Public key matches stored key | Reject + force re-pair |
| **Level 2** (Hard) | machineId matches stored ID | Freeze session + force re-pair |
| **Level 3** (Configurable) | IP address change policy | `block` / `warn` (default) / `allow` |

- **machineId**: SHA256(hostname + MAC address) — detects if the Agent moved to a different machine
- **Session Freeze**: When identity mismatch is detected, all signing requests are blocked until the user manually re-pairs
- **IP Policy**: Configurable per deployment — `block` rejects immediately, `warn` alerts the user but allows (with same-subnet tolerance), `allow` skips the check

#### 4. Relay-Side Protection

The Go Relay Server enforces additional security even though it cannot read message contents:

| Protection | Detail |
|------------|--------|
| **Per-pairId IP Binding** | Max 2 distinct source IPs per pair simultaneously |
| **Connection Rate Limit** | Max 10 new WebSocket connections per pairId per minute |
| **Connection Eviction** | If a third client connects to a pair, the oldest is evicted |
| **Metadata Logging** | Connection events logged with truncated pairId for audit |

#### 5. Manual Re-Pairing Fallback

When automatic reconnection fails (device change, key corruption, etc.):

- **Agent side**: `wallet_repair` RPC method clears stored pairing data and resets state
- **Desktop side**: "Re-pair Device" UI action in the security panel
- Both sides generate fresh key pairs, requiring a new pairing code exchange

### Part B: Key Security

#### 6. Key Isolation — Keys Never Touch the AI Model

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │  Desktop Wallet    │
│                    │  addresses, hashes │                    │
│  NO access to:     │                   │  Private key only  │
│  - private keys    │                   │  decrypted inside  │
│  - keystore file   │                   │  signTransaction() │
│  - password        │                   │  then zeroed       │
└────────────────────┘                   └────────────────────┘
```

The Agent interacts exclusively through Tool APIs. No tool ever returns key material.

#### 7. Encryption at Rest — Keystore V3

| Component | Detail |
|-----------|--------|
| **Cipher** | AES-256-GCM (authenticated encryption) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **Salt** | 32 bytes random per encryption |
| **IV** | 16 bytes random per encryption |
| **Auth Tag** | GCM tag prevents ciphertext tampering |
| **File Permissions** | 0600 (owner read/write only) |

#### 8. Memory Safety

- Private keys are decrypted only during `signTransaction()` / `signMessage()`
- Key buffers are zeroed with `Buffer.fill(0)` in `finally` blocks — even if signing throws
- Decrypted key material exists in memory for milliseconds, not seconds

#### 9. Policy Engine — Independent Spending Controls

The policy engine runs **before** any signing and cannot be bypassed through prompt injection:

| Control | Default | Description |
|---------|---------|-------------|
| Per-transaction limit | $100 | Max single transaction amount |
| Daily limit | $500 | Rolling 24h cumulative spending cap |
| Address whitelist | Empty | Required in supervised mode |
| Operating mode | Supervised | `supervised` (whitelist required) or `autonomous` (limits only) |
| Approval queue | 24h expiry | Blocked transactions queue for manual review |

**Anti-bypass measures:**
- Integer cent arithmetic to prevent floating-point precision attacks
- Case-insensitive whitelist matching
- Cryptographic random approval IDs (non-sequential, non-guessable)

#### 10. Input Validation

| Input | Validation |
|-------|-----------|
| Address | Hex format, length=42, EIP-55 checksum via viem |
| Amount | Rejects NaN, Infinity, negative, zero, empty |
| Chain | Strict whitelist (`ethereum`, `base`, `linea`, `arbitrum`, `bsc`, `optimism`, `polygon`, `sei`) |
| Token symbol | Max 20 chars, rejects injection chars |
| Contact name | Max 100 chars, rejects path traversal |

#### 11. File System & RPC Safety

- **Atomic writes**: write to temp file → rename (prevents corruption on crash)
- **0600 permissions**: only the owner can read/write sensitive files
- **Path traversal prevention**: `sanitizePath()` rejects paths outside data directory
- **Gas sanity checks**: rejects 0 gas and > 30M gas estimates
- **No key leakage**: error messages never contain private keys or passwords

---

## Features

- **Non-custodial & air-gapped** — Keys on Desktop, Agent holds zero secrets
- **End-to-end encrypted** — X25519 + AES-256-GCM, Relay sees only ciphertext
- **Automatic pairing** — One-time setup, automatic reconnection after restarts
- **Three-level verification** — Public key + device fingerprint + IP policy on every reconnect
- **Keystore V3 encryption** — AES-256-GCM + scrypt KDF for keys at rest
- **Policy engine** — Per-transaction and daily spending limits, address whitelist, approval queue
- **8 EVM chains** — Ethereum, Base, Linea, Arbitrum, BNB Chain, Optimism, Polygon, Sei; extensible to any EVM chain
- **Sub-account recovery** — Scan and recover derived accounts (BIP-44 m/44'/60'/0'/0/{n}) during wallet restore
- **Dual operating mode** — Supervised (human approves) or Autonomous (within limits)
- **Agent contacts** — P2P address book with name resolution
- **Balance monitoring** — Background polling for incoming transfers
- **Transaction history** — Local cache with full records
- **Containerized Relay** — Go Relay Server with Docker support (Hertz framework)
- **17 wallet tools** — Ready-to-use tool definitions, installable via `npx skills add janespace-ai/claw-wallet`
- **Internationalization (i18n)** — Desktop app supports English and Simplified Chinese with runtime language switching

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- Go ≥ 1.21 (for Relay Server)
- An OpenClaw-compatible AI Agent framework

### 1. Start the Relay Server

```bash
cd server
go run cmd/relay/main.go
# Default: :8765
```

Or with Docker:

```bash
cd server
docker compose up -d
```

### 2. Start the Desktop Wallet

```bash
cd desktop
npm install
npm run dev
```

### 3. Create a Wallet & Pair

1. In the Desktop app: set password → backup mnemonic
2. Click "Generate Pairing Code" → copy the 8-char code
3. In your Agent, call `wallet_pair({ shortCode: "ABCD1234" })`
4. Done — E2EE session established, automatic reconnection enabled

### 4. Use with Your Agent

17 tools available. Example conversation:

```
You:    "Send 10 USDC to Bob on Base"
Agent:  wallet_contacts_resolve("bob") → 0x742d...
        wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
        → Policy ✓ → E2EE → Desktop signs → Broadcast
        "Sent 10 USDC to Bob. tx: 0xab3f..."
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| **Wallet Management** | |
| `wallet_create` | Create a new wallet with encrypted keystore |
| `wallet_import` | Import existing wallet via private key |
| `wallet_address` | Get current wallet address |
| `wallet_pair` | Pair with Desktop Wallet via short code |
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

## Project Structure

```
wallet/
├── agent/                 # AI Agent framework (TypeScript) — zero secrets
│   ├── index.ts           # ClawWallet class — orchestrates tools & signer
│   ├── e2ee/              # E2EE crypto, WebSocket transport, machine-id
│   │   ├── crypto.ts      # X25519, AES-256-GCM, HKDF, key serialization
│   │   ├── transport.ts   # E2EE WebSocket client with extended handshake
│   │   └── machine-id.ts  # Device fingerprint (SHA256 of hostname:MAC)
│   ├── signer/            # RelaySigner — persistent pairing, auto-reconnect
│   │   ├── relay-client.ts    # Relay connection, deterministic pairId, repair
│   │   ├── ipc-server.ts     # Unix domain socket IPC server
│   │   └── ipc-client.ts     # IPC client for tool → signer communication
│   ├── tools/             # 17 wallet tool definitions
│   └── *.ts               # Policy, contacts, history, monitor, validation
│
├── desktop/               # Electron Desktop Wallet — holds all secrets
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # BIP-39 mnemonic, Keystore V3 encrypt/decrypt
│       │   ├── signing-engine.ts   # Transaction signing with memory zeroing
│       │   ├── signing-history.ts  # SQLite-backed transaction activity history
│       │   ├── tx-sync-service.ts  # Blockchain transaction status sync
│       │   ├── chain-adapter.ts    # RPC client for transaction receipts
│       │   ├── database-service.ts # SQLite connection and schema migrations
│       │   ├── price-service.ts    # Multi-tier price fetching (Gate.com, CoinGecko)
│       │   ├── balance-service.ts  # Token balance aggregation across chains
│       │   ├── relay-bridge.ts     # E2EE relay, three-level verification, session freeze
│       │   ├── security-monitor.ts # IP/device change detection, alerts
│       │   └── lock-manager.ts     # Wallet lock/unlock, idle timeout
│       ├── preload/                # Secure contextBridge (no nodeIntegration)
│       ├── renderer/               # HTML/CSS/JS UI (Activity Tab, balance display)
│       └── shared/
│           └── e2ee-crypto.ts      # Shared E2EE primitives
│
└── server/                # Go Relay Server (Hertz) — stateless forwarder
    ├── cmd/relay/main.go  # Entry point, route setup
    ├── internal/
    │   ├── hub/           # WebSocket hub, IP binding, rate limiting
    │   ├── pairing/       # Short code generation & resolution
    │   ├── middleware/     # CORS, access logging
    │   └── iputil/        # IP extraction utilities
    ├── Dockerfile         # Multi-stage build
    └── docker-compose.yml # One-command deployment
```

---

## Supported Chains & Tokens

| Chain | Chain ID | Built-in Tokens |
|-------|----------|-----------------|
| Ethereum | 1 | USDC, USDT |
| Base | 8453 | USDC, USDT |
| Linea | 59144 | USDC, USDT |
| Arbitrum | 42161 | USDC, USDT |
| BNB Chain | 56 | USDC, USDT |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Sei EVM | 1329 | USDC |

Any ERC-20 token can be used by passing its contract address. Chains are extensible — add any EVM-compatible chain through configuration.

### Web3 Network Configuration

Both Agent and Desktop support custom RPC endpoint configuration for production and local development.

#### Production Configuration

Create `config.json` with your preferred RPC providers:

```json
{
  "relayUrl": "https://relay.your-domain.com",
  "defaultChain": "base",
  "chains": {
    "ethereum":  { "rpcUrl": "https://ethereum.publicnode.com" },
    "base":      { "rpcUrl": "https://mainnet.base.org" },
    "linea":     { "rpcUrl": "https://rpc.linea.build" },
    "arbitrum":  { "rpcUrl": "https://arb1.arbitrum.io/rpc" },
    "bsc":       { "rpcUrl": "https://bsc.publicnode.com" },
    "optimism":  { "rpcUrl": "https://optimism.publicnode.com" },
    "polygon":   { "rpcUrl": "https://polygon-bor-rpc.publicnode.com" },
    "sei":       { "rpcUrl": "https://evm-rpc.sei-apis.com" }
  }
}
```

#### Local Development

Use Hardhat or Anvil for local blockchain testing:

```json
{
  "relayUrl": "http://localhost:8080",
  "defaultChain": "ethereum",
  "chains": {
    "ethereum": { "rpcUrl": "http://localhost:8545" },
    "base":     { "rpcUrl": "http://localhost:8546" }
  }
}
```

Start local nodes:

```bash
# Ethereum simulation (Chain ID: 1)
npx hardhat node --chain-id 1 --port 8545

# Base simulation (Chain ID: 8453)
npx hardhat node --chain-id 8453 --port 8546
```

See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for complete setup guide.

#### Default Behavior

If `chains` configuration is not provided, the system uses viem's built-in public RPC endpoints.

---

## Development

```bash
# Agent (TypeScript)
cd agent && npm install && npm test

# Desktop (Electron)
cd desktop && npm install && npm run dev

# Relay Server (Go)
cd server && go test ./...

# Docker deployment
cd server && docker compose up --build
```

### Test Suite

| Category | What's Tested |
|----------|---------------|
| **Keystore** | Key generation, encrypt/decrypt, wrong password, V3 structure |
| **Policy** | Limits, whitelist, modes, approval workflow, integer cent math |
| **E2EE** | Key pair serialization, deterministic pairId derivation |
| **Relay Hub** | WebSocket routing, pair IP binding, connection rate limiting |
| **Pairing** | Short code generation, expiry, resolution |
| **Middleware** | CORS configuration, access logging |
| **Security** | Key entropy, memory clearing, input injection, file permissions, path traversal, RPC safety |

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| "Wallet app offline" | Ensure Desktop Wallet is running and connected to Relay |
| "Pairing code expired" | Generate a new code (10 min TTL) |
| Signing requests blocked | Check if session is frozen (identity mismatch) — re-pair if needed |
| IP change alert | Configure IP policy: `block` / `warn` / `allow` |
| Agent can't reconnect | Use `wallet_repair` to clear pairing data and re-pair |
| Same-machine warning | Move Desktop Wallet to a separate device for full security |

---

## Internationalization (i18n)

The Desktop app supports multiple languages with runtime language switching:

### Supported Languages

- **English (en)** — Default language
- **Simplified Chinese (zh-CN)** — 简体中文

### Features

- **Auto-detection**: Automatically detects system language on first launch
- **Manual switching**: Language selector in Header (top-right corner)
- **Persistence**: User preference saved to localStorage across sessions
- **Runtime updates**: Static UI elements (buttons, labels, tabs) update immediately
- **Seamless UX**: No app restart required for language changes

### Architecture

```
i18next Framework
├── Translation Files (desktop/locales/)
│   ├── en/
│   │   ├── common.json      # Buttons labels messages
│   │   ├── setup.json       # Wallet setup flow
│   │   ├── activity.json    # Transaction activity
│   │   ├── security.json    # Security events
│   │   ├── settings.json    # Settings panel
│   │   ├── pairing.json     # Device pairing
│   │   ├── errors.json      # Error messages
│   │   ├── modals.json      # Approval export alert dialogs
│   │   └── contactsPage.json
│   └── zh-CN/ (same structure; keep keys in sync with en)
│   Note: `npm run build` copies these files to dist/renderer/locales/ for Electron.
├── Language Detection (i18n.js)
│   ├── 1. Check localStorage (user preference)
│   ├── 2. Check navigator.language (system)
│   └── 3. Fallback to English
└── DOM Update System
    ├── data-i18n attributes for static content
    └── i18next.t() for dynamic content
```

### Adding a New Language

1. Create translation directory:
   ```bash
   mkdir -p desktop/locales/<lang-code>
   ```

2. Copy and translate all JSON files from `en/`:
   ```bash
   cp desktop/locales/en/*.json desktop/locales/<lang-code>/
   # Edit each file to translate values
   ```

3. Add language option to selector in `index.html`:
   ```html
   <select id="language-selector">
     <option value="en">English</option>
     <option value="zh-CN">简体中文</option>
     <option value="<lang-code>">Your Language</option>
   </select>
   ```

4. Update namespace list in `i18n.js` if needed

### Translation Key Conventions

Use hierarchical, semantic naming:

```
namespace.feature.element

Examples:
- common.buttons.save
- setup.password.placeholder
- errors.wallet.createFailed
- activity.filters.pending
```

### For Developers

**HTML (static content)**:
```html
<button data-i18n="common.buttons.save">Save</button>
<input data-i18n-placeholder="setup.password.placeholder" />
```

**JavaScript (dynamic content)**:
```javascript
alert(i18next.t('errors.password.mismatch'));
document.title = i18next.t('common.labels.wallet');
```

**With interpolation**:
```javascript
const msg = i18next.t('common.contacts.removeConfirm', { name: 'Bob' });
// Translation: "Remove all entries for contact \"{name}\"?"
```

---

## License

MIT
