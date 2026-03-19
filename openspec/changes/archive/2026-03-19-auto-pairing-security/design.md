## Context

The Claw Wallet uses a three-component architecture: AI Agent, Go Relay Server, and Electron Desktop Wallet. The Agent and Desktop communicate via E2EE-encrypted WebSocket messages routed through the Relay. Currently, pairing requires the user to manually copy an 8-character short code from Desktop to Agent every time either side restarts, because both sides call `generateKeyPair()` fresh on each launch. The Relay is fully stateless and performs no identity validation beyond grouping connections by `pairId`.

Existing security monitors detect IP changes and device fingerprint mismatches but only log them — they never block operations or force re-pairing.

Key files involved:
- `desktop/src/main/relay-bridge.ts` — Desktop's relay connection, pairing, handshake
- `agent/signer/relay-client.ts` — Agent's relay connection, pairing, RPC handling
- `agent/e2ee/transport.ts` — Agent's WebSocket transport and E2EE session
- `desktop/src/main/security-monitor.ts` — Security event logging (currently passive)
- `server/internal/hub/hub.go` — Relay WebSocket hub
- `server/internal/pairing/pairing.go` — Relay short-code store

## Goals / Non-Goals

**Goals:**
- Users pair once (first wallet creation) and never need to manually pair again under normal operation.
- Desktop enforces identity verification on every reconnection: public key continuity, device fingerprint match, IP change policy.
- MachineId mismatch triggers forced re-pairing (hard block, not just a warning).
- IP change triggers configurable policy (block → warn → allow) instead of silent logging.
- Relay validates per-pairId connection patterns to detect abuse.
- Manual re-pairing is available as a fallback when automatic reconnection fails.

**Non-Goals:**
- Certificate pinning or mutual TLS between clients and Relay (future work, requires TLS deployment first).
- Multi-device pairing (one Agent paired to multiple Desktops simultaneously).
- Key rotation protocol (periodic re-keying of persistent comm keys — future enhancement).
- Server-side persistent storage (Relay remains stateless across restarts).

## Decisions

### Decision 1: Persist comm key pairs encrypted at rest

**Choice:** Both Desktop and Agent persist their X25519 communication key pairs to disk, encrypted.

- Desktop: encrypt the private key with the wallet password via scrypt+AES-GCM (same KDF already used for mnemonic), store alongside `pairings.enc.json`.
- Agent: store in `pairing.json` with filesystem permissions (0600). The Agent typically runs in a controlled server environment where disk encryption is handled at the OS level.

**Alternatives considered:**
- *Derive comm keys from wallet mnemonic (BIP-32 path)*: Rejected — couples communication identity to wallet identity, and Agent doesn't have the mnemonic.
- *Keep ephemeral keys, just auto-re-handshake*: Rejected — without persistent keys, there's no way to verify the peer is the same entity as before (any attacker could initiate a handshake).

### Decision 2: Deterministic pairId derivation

**Choice:** `pairId = SHA256(walletAddress + ":" + agentPublicKeyHex).slice(0, 16)`

Both sides independently compute the same pairId from their stored pairing info. No timestamps, no randomness.

**Rationale:** Eliminates the need to coordinate pairId during reconnection. Both sides just connect to the Relay with the same derived pairId. If either side's key changes (legitimate re-pairing), the pairId naturally changes too.

**Alternatives considered:**
- *UUID-based pairId stored on both sides*: Works but adds unnecessary state synchronization.

### Decision 3: Extended handshake message format

**Choice:** Extend the handshake WebSocket message to include identity metadata:

```json
{
  "type": "handshake",
  "publicKey": "<hex>",
  "machineId": "<hash>",
  "reconnect": true
}
```

The `reconnect` flag tells the receiver whether this is a first-time pairing (`false`) or a reconnection (`true`). Desktop uses this to decide which verification path to take:
- `reconnect: false` → normal first-time pairing flow (show confirmation dialog)
- `reconnect: true` → three-level identity verification

### Decision 4: Three-level verification on reconnection

**Choice:** Desktop performs sequential checks on reconnection handshake:

1. **Public key check** (hard): `receivedPubKey === storedDevice.commPublicKey`. Fail → reject connection, require re-pairing.
2. **MachineId check** (hard): `receivedMachineId === storedDevice.machineId`. Fail → reject connection, freeze session, require re-pairing.
3. **IP check** (soft, configurable):
   - `same_subnet` → silent allow, update lastIP
   - `cross_subnet` → warn user, require confirmation for next transaction
   - User can configure `ipChangePolicy: "block" | "warn" | "allow"` (default: `"warn"`)

Subnet comparison: compare first 24 bits of IPv4 (or first 48 bits of IPv6) to determine same-subnet.

### Decision 5: Relay-side pairId binding

**Choice:** The Relay Hub tracks the set of distinct IPs connected per pairId. Enforcement rules:

- Max 2 distinct IPs per pairId at any time (one for Agent, one for Desktop). A third IP attempting to connect with the same pairId gets rejected with HTTP 403.
- Per-pairId connection rate: max 10 new WebSocket connections per minute. Prevents rapid reconnect abuse.

**Implementation:** Add an `ipSet` field to the Hub's pair tracking. On register, check IP count. On unregister, clean up.

**Rationale:** A legitimate pair only ever has 2 participants. If a third IP tries to join, it's either an attack or a misconfiguration.

### Decision 6: Manual re-pairing fallback

**Choice:** Two paths for manual re-pairing:

- **Agent-initiated:** AI invokes `wallet_repair` RPC → Agent clears stored pairing → prompts user to generate a new code in Desktop → follows the original `wallet_pair` flow.
- **Desktop-initiated:** User clicks "Re-pair Device" in settings → Desktop revokes the existing pairing (already implemented via `revokePairing()`) → generates a new short code → user enters it in Agent.

In both cases, the flow converges to the existing short-code mechanism — no new protocol needed.

### Decision 7: Key pair serialization format

**Choice:** Use raw hex encoding for public keys (already the convention in the codebase) and store private keys as hex within an encrypted envelope:

```json
{
  "publicKey": "<64-char hex>",
  "privateKey": "<encrypted-hex>",
  "createdAt": "<ISO-8601>"
}
```

Desktop encrypts the privateKey field using the existing scrypt+AES-GCM mechanism from `security-keystore`. Agent stores privateKey as plaintext hex in the 0600-permission file (consistent with existing `pairing.json` approach).

## Risks / Trade-offs

**[Risk] Persistent private key on disk increases attack surface**
→ Mitigation: Desktop encrypts with wallet password. Agent relies on OS filesystem permissions. This is the same model already used for mnemonic storage. Key rotation can be added later.

**[Risk] Subnet-based IP comparison is imprecise**
→ Mitigation: The IP check is the softest layer (Level 3), configurable to "allow" for users with unstable networks. The hard security boundary is public key + machineId.

**[Risk] MachineId can be spoofed (hostname + MAC are user-controllable)**
→ Mitigation: MachineId is Level 2, not the sole defense. An attacker would also need the persistent private key (Level 1) to pass verification. MachineId catches the common case of stolen `pairing.json` being used on a different machine.

**[Risk] Relay pairId IP binding could block legitimate roaming**
→ Mitigation: The limit is 2 *simultaneous* distinct IPs, not historical. If an Agent changes IP, the old connection drops first, freeing a slot. Only truly concurrent connections from 3+ IPs get blocked.

**[Trade-off] First-time pairing still requires manual code entry**
→ Accepted: The short code is the trust anchor. Without an out-of-band channel, there's no secure way to automate the very first introduction. But it only happens once per wallet lifetime.
