## 1. Shared Crypto — Key Pair Serialization

- [x] 1.1 Add `serializeKeyPair(kp)` and `deserializeKeyPair(hex)` helpers to `desktop/src/shared/e2ee-crypto.ts` for converting X25519 key pairs to/from hex strings
- [x] 1.2 Add the same serialization helpers to `agent/e2ee/crypto.ts` (mirror implementation)

## 2. Desktop — Persistent Key Pair

- [x] 2.1 Add `loadOrCreateKeyPair()` to `relay-bridge.ts` that checks for `comm-keypair.enc.json`, decrypts and loads if exists, or generates + encrypts + saves a new one
- [x] 2.2 Replace `this.keyPair = generateKeyPair()` in RelayBridge constructor with the async `loadOrCreateKeyPair()` call
- [x] 2.3 Store the key pair encrypted using the existing scrypt+AES-GCM mechanism from `security-keystore`

## 3. Agent — Persistent Key Pair

- [x] 3.1 Add `loadOrCreateKeyPair()` to `relay-client.ts` that saves/loads the comm key pair in `pairing.json`
- [x] 3.2 Pass the persisted key pair to `RelayTransport` constructor via the `keyPair` option (already supported)
- [x] 3.3 Update `savePairing()` to include the Agent's own public + private key hex alongside existing fields

## 4. Deterministic PairId

- [x] 4.1 Add `derivePairId(walletAddress, agentPubKeyHex)` utility function returning `SHA256(walletAddress + ":" + agentPubKeyHex).slice(0, 16)`
- [x] 4.2 Replace the random pairId generation in `relay-client.ts` `handlePair()` with `derivePairId()`
- [x] 4.3 Replace the timestamp-based pairId generation in `relay-bridge.ts` `handleHandshake()` with `derivePairId()` using stored wallet address and received agent public key
- [x] 4.4 Update `connectRelay()` in both Desktop and Agent to compute pairId from stored pairing data on reconnection

## 5. Extended Handshake Message

- [x] 5.1 Modify `sendHandshake()` in `agent/e2ee/transport.ts` to include `machineId` and `reconnect` fields
- [x] 5.2 Add `getMachineId()` as a shared utility (currently duplicated in `relay-client.ts` and `relay-bridge.ts`)
- [x] 5.3 Update `relay-client.ts` `connectRelay()` to pass `machineId` to the transport and set `reconnect: true` when restoring from saved pairing

## 6. Desktop — Three-Level Reconnection Verification

- [x] 6.1 Refactor `handleHandshake()` in `relay-bridge.ts` to check if the sender is a known paired device (match by publicKey in stored devices)
- [x] 6.2 Implement Level 1: public key continuity check — reject and emit `key_mismatch` event if public key doesn't match any stored device
- [x] 6.3 Implement Level 2: machineId check — reject and freeze if `machineId` from handshake doesn't match `storedDevice.machineId`
- [x] 6.4 Implement Level 3: IP change policy — read `ipChangePolicy` from config, apply block/warn/allow logic based on `sourceIP` vs `storedDevice.lastIP`
- [x] 6.5 Add `ipChangePolicy` field to Desktop settings (default: `"warn"`), exposed via IPC for the UI to read/write
- [x] 6.6 Add subnet comparison utility for Level 3 (compare first 24 bits of IPv4)

## 7. Desktop — Enforced Security Actions

- [x] 7.1 Modify `handleSignRequest()` to check session freeze state before processing — return error if session is frozen
- [x] 7.2 Add `frozenSessions: Map<deviceId, { until: number, reason: string }>` to RelayBridge state
- [x] 7.3 Add `freezeSession(deviceId, reason, durationMs)` and `unfreezeSession(deviceId)` methods
- [x] 7.4 Wire Level 2 failure (machineId mismatch) to `freezeSession()` with indefinite duration (until re-pairing)

## 8. Manual Re-pairing Fallback

- [x] 8.1 Add `wallet_repair` method to Agent's `handleRequest()` switch in `relay-client.ts` — clears stored pairing, disconnects transport, returns instructions to user
- [x] 8.2 Add "Re-pair Device" action in Desktop UI that calls `revokePairing()` then `generatePairCode()` for the specified device
- [x] 8.3 On Level 1/Level 2 verification failure, emit a notification to Desktop UI with a "Re-pair" action button
- [x] 8.4 Update Desktop preload API to expose the re-pair action to the renderer process

## 9. Relay — Per-PairId IP Binding

- [x] 9.1 Add `pairIPs map[string]map[string]bool` field to Hub struct in `hub.go` tracking distinct IPs per pairId
- [x] 9.2 On `register()`: check `len(pairIPs[pairId])` — if already 2 distinct IPs and new IP is different, close connection with code 4003
- [x] 9.3 On `unregister()`: remove IP from `pairIPs` if no other clients from that IP remain for the pairId
- [x] 9.4 Add connection event logging: pairId (truncated), action, source IP, active count

## 10. Relay — Per-PairId Connection Rate Limit

- [x] 10.1 Add `pairConnRate map[string]*rateBucket` to Hub struct for per-pairId connection rate tracking
- [x] 10.2 On `register()`: check connection rate — if >10 connections per minute for this pairId, close with code 4029
- [x] 10.3 Add cleanup goroutine to periodically clear stale rate buckets from `pairConnRate`

## 11. Testing

- [x] 11.1 Add unit tests for `serializeKeyPair` / `deserializeKeyPair` in both Desktop and Agent
- [x] 11.2 Add unit test for `derivePairId()` — verify determinism and consistency between Desktop and Agent implementations
- [x] 11.3 Add test for three-level verification: mock handshakes with matching/mismatching pubKey, machineId, and IP
- [x] 11.4 Add test for Hub IP binding: connect 3 clients from 3 IPs to same pairId, verify third is rejected
- [x] 11.5 Add test for Hub connection rate limit: rapid reconnections to same pairId exceed limit
- [x] 11.6 Add test for `wallet_repair` RPC: verify pairing data is cleared and transport is disconnected
- [x] 11.7 Add test for session freeze: verify frozen session rejects sign requests

## 12. Verification

- [x] 12.1 Run all existing tests to ensure no regressions (`go test ./...` for server, `npm test` for Desktop/Agent)
- [ ] 12.2 Manual integration test: pair Desktop and Agent, restart both, verify automatic reconnection without code entry
- [ ] 12.3 Manual integration test: modify Agent's machineId, verify Desktop rejects and prompts re-pairing
