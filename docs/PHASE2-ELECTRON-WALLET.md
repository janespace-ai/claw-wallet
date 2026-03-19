# Phase 2: Electron Desktop Wallet — Architecture & Security Guide

## Overview

Phase 2 removes private keys from the Agent machine entirely. Keys live in a separate **Electron Desktop Wallet** that communicates with the Agent via an **E2EE (End-to-End Encrypted)** channel through a **Go Relay Server** (Hertz framework).

## Architecture

```
┌──────────────┐     E2EE/WebSocket      ┌────────────┐     E2EE/WebSocket     ┌──────────────────┐
│  Agent (CLI)  │◄────────────────────────►│ Go Relay   │◄─────────────────────►│ Electron Wallet  │
│  agent/       │     via Relay            │ server/    │     via Relay          │ desktop/         │
│               │                          │            │                        │                  │
│ • wallet_pair │   ┌──────────────┐       │ • WS Hub   │                        │ • BIP-39 keygen  │
│ • wallet_send │   │ Persistent   │       │ • Pairing  │                        │ • AES-256 store  │
│ • wallet_*    │   │ Key Pairs +  │       │ • IP bind  │                        │ • Sign engine    │
│ • wallet_repair│  │ Auto-Reconnect│      │ • Rate lim │                        │ • 3-Level verify │
└──────────────┘   └──────────────┘       └────────────┘                        │ • Security mon.  │
                                                                                 │ • Lock manager   │
                                                                                 │ • Session freeze │
                                                                                 └──────────────────┘
```

## Key Security Properties

1. **Zero-secret Agent** — Agent never holds private keys or mnemonics
2. **E2EE** — X25519 ECDH + HKDF-SHA256 → AES-256-GCM with anti-replay nonces
3. **Automatic Pairing & Reconnection** — One-time manual pairing, persistent key pairs enable automatic reconnection after restarts
4. **Three-Level Reconnection Verification** — Public key continuity + machineId binding + configurable IP policy
5. **Relay-Side Protection** — Per-pairId IP binding (max 2 IPs) + connection rate limiting (10/min)
6. **Session Freeze** — Identity mismatch triggers signing block until re-paired
7. **Allowance Budget** — Auto-sign within daily/per-tx limits; manual approval beyond
8. **Lock Modes** — Convenience (default: keep keys in memory) or Strict (idle timeout wipe)

## Pairing Flow

### First-Time Pairing (Manual — one-time only)

1. Open Electron Wallet App → "Pairing" tab → "Generate Pairing Code"
2. Copy the 8-char short code (valid 10 minutes)
3. In Agent: `wallet_pair { shortCode: "ABCD1234" }`
4. Agent resolves code via Relay, exchanges X25519 public keys, establishes E2EE session
5. Both sides save persistent communication key pairs to disk:
   - Desktop: encrypted with wallet password (scrypt + AES-256-GCM) as `comm-keypair.json`
   - Agent: file-permission protected (0600)
6. Both sides derive deterministic pairId: `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]`
7. machineId exchange → same-machine check → security alert if same host

### Automatic Reconnection (after restart — no user action)

1. Agent loads persistent comm key pair from disk, recomputes pairId
2. Desktop loads and decrypts persistent comm key pair, recomputes same pairId
3. Both connect to Relay, which routes by pairId
4. Agent sends extended handshake message:
   - `publicKey`: agent's X25519 public key (hex)
   - `machineId`: SHA256(hostname:MAC)[:16]
   - `reconnect: true`
5. Desktop performs three-level verification (see below)
6. If all checks pass → E2EE session restored automatically

### Manual Re-Pairing (fallback)

When automatic reconnection fails (device change, key corruption, IP blocked):

- **Agent side**: `wallet_repair` RPC method — clears stored pairing data, resets state
- **Desktop side**: "Re-pair Device" UI action in security panel — clears peer data
- Both sides generate fresh key pairs, requiring a new pairing code exchange

## Three-Level Reconnection Verification

When an Agent reconnects, the Desktop performs three identity checks:

### Level 1: Public Key Continuity (Hard Requirement)

- Compare received Agent public key against stored key
- **Match**: proceed to Level 2
- **Mismatch**: reject connection, emit `key_mismatch` security alert, require manual re-pairing

### Level 2: machineId Continuity (Hard Requirement)

- Compare received machineId against stored machineId
- machineId = `SHA256(hostname + ":" + MAC_address)[:16]`
- **Match**: proceed to Level 3
- **Mismatch**: freeze session (block all signing), emit `device_mismatch` security alert, require manual re-pairing

### Level 3: IP Change Policy (Configurable)

- Compare Agent's current source IP against stored IP
- Three modes:
  - `block`: reject connection immediately if IP changed
  - `warn` (default): emit `ip_change` alert but allow connection; same /24 subnet changes are tolerated silently
  - `allow`: skip IP check entirely

## Relay-Side Protection

The Go Relay Server enforces security measures even though it only forwards ciphertext:

### Per-pairId IP Binding

- Tracks distinct source IPs for each pairId
- Maximum 2 distinct IPs simultaneously per pair
- If a third IP connects, the oldest connection is evicted
- Prevents pair hijacking from unauthorized locations

### Per-pairId Connection Rate Limiting

- Maximum 10 new WebSocket connections per pairId per minute
- Uses token bucket algorithm with automatic cleanup
- Prevents connection flood attacks

### Connection Metadata Logging

- Logs connection/disconnection events with truncated pairId for audit
- Logs active client count per pair

## Transaction Flow

1. Agent calls `wallet_send` → IPC to RelaySigner → E2EE to Wallet App
2. Desktop checks if session is frozen:
   - **Frozen** → reject signing request immediately
   - **Not frozen** → proceed
3. Wallet App checks allowance budget:
   - **Within budget** → auto-sign → return signature
   - **Over budget** → show approval dialog → user approves/rejects
4. Result encrypted and sent back via Relay

## Session Freeze Mechanism

When Level 1 or Level 2 verification fails:

1. The session is marked as "frozen" for the affected pairId
2. All `sign_transaction` requests for that pair are rejected with "Session frozen" error
3. The user must manually initiate re-pairing (Desktop UI or Agent `wallet_repair`)
4. Re-pairing generates fresh key pairs and clears the frozen state

## Directory Structure

```
wallet/
├── agent/          # Agent framework (TypeScript) — zero-secret
│   ├── e2ee/       # E2EE crypto + WebSocket transport + machine-id
│   ├── signer/     # RelaySigner (relay-client.ts) + persistent pairing + IPC
│   └── tools/      # MCP tools (wallet_pair, wallet_create, wallet_repair, ...)
├── server/         # Go Relay Server (Hertz) — stateless WS forwarder
│   ├── cmd/relay/  # main.go entry point
│   └── internal/   # hub/ (WS routing, IP binding, rate limit) + pairing/ (short codes)
└── desktop/        # Electron Wallet App — holds all secrets
    └── src/
        ├── main/       # key-manager, signing-engine, relay-bridge (3-level verify),
        │               # security-monitor, lock-manager
        ├── preload/    # contextBridge (no nodeIntegration)
        ├── renderer/   # HTML/CSS/JS UI
        └── shared/     # E2EE crypto (desktop copy)
```

## First-Time Setup

1. **Start Relay Server**: `cd server && go run cmd/relay/main.go` (default `:8765`)
   - Or with Docker: `cd server && docker compose up -d`
2. **Start Electron App**: `cd desktop && npm run dev`
3. **Create Wallet**: Set password → backup mnemonic
4. **Generate Pairing Code**: Pairing tab → Generate → copy code
5. **Connect Agent**: Agent calls `wallet_pair` with the code
6. **Done**: Automatic reconnection enabled — no further manual pairing needed

## Troubleshooting

| Issue | Solution |
|-------|---------|
| "Wallet app offline" | Ensure Electron App is running and connected to Relay |
| "Pairing code expired" | Generate a new code (10 min TTL) |
| Signing blocked / "Session frozen" | Identity mismatch detected — re-pair using Desktop UI or Agent `wallet_repair` |
| Same-machine warning | Move Wallet App to a separate device for full security |
| IP change alert | Configure IP policy (`block`/`warn`/`allow`) in Desktop settings |
| Agent can't reconnect after restart | Check if comm key pair file exists; use `wallet_repair` if corrupted |
| "Rate limited" (code 4029) | Too many connection attempts — wait 1 minute before retrying |
| "IP limit exceeded" (code 4003) | Too many distinct IPs for this pair — check for unauthorized connections |
