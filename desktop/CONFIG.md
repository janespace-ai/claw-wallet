# Desktop configuration

Copy an example under `desktop/` to your real config:

- Default: `cp config.example.json config.json`
- Production-oriented: `config.prod.example.json`
- Local dev (local chains, relaxed limits): `config.local.example.json`

At runtime the app reads `config.json` from the current working directory (see `src/main/config.ts`). Omitted keys use in-code defaults.

## Environment variables (override file values)

| Variable | Purpose |
|----------|---------|
| `CLAW_DESKTOP_RELAY_URL` | Relay WebSocket URL |
| `CLAW_DESKTOP_IP_POLICY` | `block` / `warn` / `allow` |
| `CLAW_DESKTOP_LOCK_MODE` | `convenience` / `strict` |
| `CLAW_DESKTOP_SCRYPT_N` | Keystore scrypt `N` as a numeric string |

## Top-level keys

| Path | Description |
|------|-------------|
| `relayUrl` | Relay WebSocket URL, e.g. `ws://localhost:8080`. |
| `ipChangePolicy` | Peer IP change handling: `block`, `warn`, or `allow`. |
| `lockMode` | `convenience` allows biometric unlock; `strict` enforces password plus idle lockout. |
| `chains` | Optional per-chain RPC overrides; omit to use built-in public defaults. |
| `chains.ethereum.rpcUrl` | Ethereum mainnet RPC; omit chain or leave empty for default. |
| `chains.base.rpcUrl` | Base mainnet RPC; same as above. |
| `relay.reconnectBaseMs` | Base delay in ms before the first reconnect attempt. |
| `relay.reconnectMaxMs` | Upper bound for reconnect backoff in ms. |
| `signing.dailyLimitUsd` | Max total USD value of auto-approved txs per day. |
| `signing.perTxLimitUsd` | Max USD value per auto-approved tx. |
| `signing.tokenWhitelist` | Token symbols eligible for auto-approval. |
| `signing.autoApproveWithinBudget` | If `true`, txs within limits may sign without a desktop prompt; if `false`, every on-chain tx needs in-app approval (`false` recommended for wallets). |
| `lock.strictIdleTimeoutMs` | Idle time in ms before auto-lock in `strict` mode (e.g. `300000` = 5 minutes). |
| `security.maxEvents` | Max security events kept in memory. |
| `keyring.scryptN` | Optional. Keystore scrypt `N` (default `16384`). Keep moderate to stay within Electron/OpenSSL memory limits; overridden by `CLAW_DESKTOP_SCRYPT_N` when set. |

## Local example file

`config.local.example.json` is tuned for local Anvil/Hardhat RPC (e.g. `8545` / `8546`), shorter reconnect delays, higher signing limits, and a long `strictIdleTimeoutMs`. **Local use only**—do not use in production.

Example local nodes (ports match the sample): Ethereum `npx hardhat node --chain-id 1 --port 8545`; Base `npx hardhat node --chain-id 8453 --port 8546`.
