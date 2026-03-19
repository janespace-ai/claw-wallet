# Phase 2A: Electron Wallet App — Architecture & User Guide

## Overview

Phase 2 removes private keys from the Agent machine entirely. Keys live in a separate **Electron Wallet App** that communicates with the Agent via an **E2EE (End-to-End Encrypted)** channel through a **Go Relay Server**.

## Architecture

```
┌──────────────┐     E2EE/WebSocket      ┌────────────┐     E2EE/WebSocket     ┌──────────────────┐
│  Agent (CLI)  │◄────────────────────────►│ Go Relay   │◄─────────────────────►│ Electron Wallet  │
│  agent/       │     via Relay            │ server/    │     via Relay          │ desktop/         │
│               │                          │            │                        │                  │
│ • wallet_pair │   ┌──────────────┐       │ • WS Hub   │                        │ • BIP-39 keygen  │
│ • wallet_send │   │ Short Code   │       │ • Pairing  │                        │ • AES-256 store  │
│ • wallet_*    │   │ Pairing      │       │ • IP inject│                        │ • Sign engine    │
│               │   └──────────────┘       │            │                        │ • Biometric auth │
└──────────────┘                           └────────────┘                        │ • Security mon.  │
                                                                                 │ • Lock manager   │
                                                                                 └──────────────────┘
```

## Key Security Properties

1. **Zero-secret Agent** — Agent never holds private keys or mnemonics
2. **E2EE** — X25519 ECDH + HKDF-SHA256 → AES-256-GCM with anti-replay nonces
3. **IP + Device Fingerprint Binding** — Relay injects sourceIP; Electron detects changes and alerts
4. **Same-Machine Detection** — Mandatory warning if Agent and Wallet run on same host
5. **Allowance Budget** — Auto-sign within daily/per-tx limits; manual approval beyond
6. **Lock Modes** — Convenience (default: keep keys in memory) or Strict (idle timeout wipe)

## Pairing Flow

1. Open Electron Wallet App → "Pairing" tab → "Generate Pairing Code"
2. Copy the 8-char short code (valid 10 minutes)
3. In Agent: `wallet_pair { shortCode: "ABCD1234" }`
4. Agent resolves code via Relay, exchanges public keys, establishes E2EE session
5. machineId exchange → same-machine check → security alert if same host

## Transaction Flow

1. Agent calls `wallet_send` → IPC to RelaySigner → E2EE to Wallet App
2. Wallet App checks allowance budget:
   - **Within budget** → auto-sign → return signature
   - **Over budget** → show approval dialog → user approves/rejects
3. If wallet is frozen (security alert), all signing is blocked for 30 minutes

## Directory Structure

```
wallet/
├── agent/          # Agent framework (TypeScript) — zero-secret
│   ├── e2ee/       # E2EE crypto + WebSocket transport
│   ├── signer/     # RelaySigner (relay-client.ts) + IPC
│   └── tools/      # MCP tools (wallet_pair, wallet_create, ...)
├── server/         # Go Relay Server — stateless WS forwarder
│   ├── cmd/relay/  # main.go entry point
│   └── internal/   # hub/ (WS routing) + pairing/ (short codes)
└── desktop/        # Electron Wallet App — holds all secrets
    └── src/
        ├── main/       # key-manager, signing-engine, relay-bridge, security-monitor, lock-manager
        ├── preload/    # contextBridge (no nodeIntegration)
        ├── renderer/   # HTML/CSS/JS UI
        └── shared/     # E2EE crypto (desktop copy)
```

## First-Time Setup

1. **Start Relay Server**: `cd server && go run cmd/relay/main.go` (default `:8765`)
2. **Start Electron App**: `cd desktop && npm run dev`
3. **Create Wallet**: Set password → backup mnemonic
4. **Generate Pairing Code**: Pairing tab → Generate → copy code
5. **Connect Agent**: Agent calls `wallet_pair` with the code

## Troubleshooting

| Issue | Solution |
|-------|---------|
| "Wallet app offline" | Ensure Electron App is running and connected to Relay |
| "Pairing code expired" | Generate a new code (10 min TTL) |
| "Wallet is frozen" | Wait 30 min or dismiss security alert in the app |
| Same-machine warning | Move Wallet App to a separate device for full security |
| IP change alert | Verify the Agent's new IP, then choose: freeze / allow once / trust |
