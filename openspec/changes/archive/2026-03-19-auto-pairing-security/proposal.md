## Why

Current pairing between Desktop Wallet and Agent requires manual short-code entry every time either side restarts, because communication key pairs are regenerated on each launch. Additionally, existing security checks (IP change, device fingerprint) only log warnings without enforcing any restrictions. This creates both a poor user experience (frequent manual re-pairing) and a security gap (compromised credentials are never blocked).

## What Changes

- **Persistent communication key pairs**: Both Desktop and Agent persist their X25519 comm key pairs to disk (encrypted), eliminating the need to re-pair after restart.
- **Deterministic pairId**: Derive pairId from `SHA256(walletAddress + agentPublicKey)` so both sides independently compute the same value.
- **Three-level reconnection verification**: On every reconnection handshake, Desktop enforces: (1) public key continuity check — must match stored key, (2) machineId continuity check — must match stored device fingerprint, (3) IP change policy — configurable action (block/warn/allow).
- **Enforced security actions**: IP change and machineId mismatch now trigger session freeze or forced re-pairing instead of just logging.
- **Relay-side pairId binding**: Relay validates that a pairId is not connected from more than 2 distinct IPs simultaneously, and enforces a per-pairId connection rate limit.
- **Manual re-pairing fallback**: Agent exposes a `wallet_repair` RPC method and Desktop provides a "Re-pair Device" UI action for cases where automatic reconnection fails due to identity mismatch.
- **Handshake protocol extension**: The handshake message now includes `machineId` and a `reconnect` flag so Desktop can distinguish first-time pairing from reconnection attempts.

## Capabilities

### New Capabilities
- `auto-reconnect-pairing`: Covers persistent key pairs, deterministic pairId, automatic reconnection handshake with identity verification, and manual re-pairing fallback.
- `relay-connection-security`: Covers relay-side pairId binding, per-pairId IP limits, and connection rate limiting.

### Modified Capabilities
- `wallet-pairing`: Update reconnection scenario to use persisted keys instead of fresh key generation; add forced re-pairing on identity mismatch.
- `device-security`: Upgrade IP change and machineId mismatch from warning-only to enforced session freeze / forced re-pairing.
- `e2ee-communication`: Change from ephemeral-only keys to persistent comm keys with optional re-keying; update handshake to carry machineId.
- `go-relay-server`: Add per-pairId IP binding validation and connection rate limiting.

## Impact

- **Desktop** (`relay-bridge.ts`): Key pair persistence, handshake verification logic, session freeze enforcement, re-pair UI flow.
- **Agent** (`relay-client.ts`, `transport.ts`): Key pair persistence, extended handshake message, `wallet_repair` RPC method.
- **Server** (`hub.go`, `main.go`): Per-pairId IP tracking, connection rate limiting.
- **Shared crypto** (`e2ee-crypto.ts`, `crypto.ts`): Key serialization/deserialization helpers.
- **Security** (`security-monitor.ts`): Enforce freeze on identity mismatch instead of just logging.
- **API**: New `wallet_repair` JSON-RPC method on Agent IPC; extended handshake WebSocket message format.
