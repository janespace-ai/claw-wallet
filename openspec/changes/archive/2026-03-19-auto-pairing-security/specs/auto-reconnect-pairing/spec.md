## ADDED Requirements

### Requirement: Persistent communication key pair
Both the Desktop Wallet and Agent Signer SHALL persist their X25519 communication key pairs to disk so that paired devices can reconnect without user intervention after restarts.

#### Scenario: Desktop persists comm key pair
- **WHEN** the Desktop Wallet generates a communication key pair for the first time
- **THEN** it SHALL encrypt the private key using the existing scrypt+AES-GCM mechanism (wallet password) and store both public and encrypted private key to `comm-keypair.enc.json` with 0600 permissions

#### Scenario: Desktop loads persisted key pair on startup
- **WHEN** the Desktop Wallet starts and `comm-keypair.enc.json` exists
- **THEN** it SHALL load and decrypt the key pair instead of generating a new one

#### Scenario: Agent persists comm key pair
- **WHEN** the Agent Signer generates a communication key pair for the first time
- **THEN** it SHALL store the key pair in `pairing.json` alongside other pairing data with 0600 permissions

#### Scenario: Agent loads persisted key pair on startup
- **WHEN** the Agent Signer starts and `pairing.json` contains a saved key pair
- **THEN** it SHALL load the key pair and use it for the relay transport instead of generating a new one

### Requirement: Deterministic pairId derivation
The pairId SHALL be derived deterministically from the wallet address and Agent's communication public key so that both sides independently compute the same value.

#### Scenario: PairId computation
- **WHEN** a pairing is established or restored from persistence
- **THEN** the pairId SHALL be computed as `SHA256(walletAddress + ":" + agentPublicKeyHex).slice(0, 16)`

#### Scenario: Both sides derive same pairId
- **WHEN** Desktop and Agent each compute the pairId from their stored pairing data
- **THEN** both SHALL arrive at the identical pairId value without any coordination

### Requirement: Automatic reconnection with identity verification
On reconnection, the Desktop Wallet SHALL perform three-level identity verification before restoring the E2EE session.

#### Scenario: Level 1 — Public key continuity (hard check)
- **WHEN** a reconnection handshake is received and the sender's public key does NOT match the stored `commPublicKey` for that device
- **THEN** the Desktop SHALL reject the connection, destroy any pending session, and emit a `key_mismatch` security event requiring re-pairing

#### Scenario: Level 1 — Public key matches
- **WHEN** a reconnection handshake is received and the sender's public key matches the stored `commPublicKey`
- **THEN** the Desktop SHALL proceed to Level 2 verification

#### Scenario: Level 2 — MachineId continuity (hard check)
- **WHEN** the handshake includes a `machineId` that does NOT match the stored `machineId` for that device
- **THEN** the Desktop SHALL reject the connection, freeze the session, emit a `device_mismatch` security event, and require manual re-pairing

#### Scenario: Level 2 — MachineId matches
- **WHEN** the handshake `machineId` matches the stored value
- **THEN** the Desktop SHALL proceed to Level 3 verification

#### Scenario: Level 3 — IP change policy (configurable)
- **WHEN** the source IP differs from the stored `lastIP` and the IP change policy is `"warn"`
- **THEN** the Desktop SHALL allow the connection but require user confirmation for the next transaction and display an IP change alert

#### Scenario: Level 3 — IP policy set to block
- **WHEN** the source IP differs from the stored `lastIP` and the IP change policy is `"block"`
- **THEN** the Desktop SHALL reject the connection and require manual re-pairing

#### Scenario: Level 3 — IP policy set to allow
- **WHEN** the source IP differs from the stored `lastIP` and the IP change policy is `"allow"`
- **THEN** the Desktop SHALL silently accept the connection and update `lastIP`

### Requirement: Extended handshake message
The WebSocket handshake message SHALL include identity metadata to enable verification.

#### Scenario: Handshake message format on reconnection
- **WHEN** a paired device sends a handshake during reconnection
- **THEN** the message SHALL include fields: `type` ("handshake"), `publicKey` (hex), `machineId` (hash), and `reconnect` (boolean, true for reconnection)

#### Scenario: First-time pairing handshake
- **WHEN** a device sends a handshake during initial pairing
- **THEN** the message SHALL include the same fields with `reconnect` set to false

### Requirement: Manual re-pairing fallback
The system SHALL support manual re-pairing when automatic reconnection fails.

#### Scenario: Agent-initiated re-pairing via wallet_repair
- **WHEN** the AI invokes `wallet_repair` RPC on the Agent
- **THEN** the Agent SHALL clear its stored pairing data, prompt the user to generate a new short code in the Desktop Wallet, and await a new `wallet_pair` call with the fresh code

#### Scenario: Desktop-initiated re-pairing
- **WHEN** the user clicks "Re-pair Device" in Desktop settings for a device with a failed identity check
- **THEN** the Desktop SHALL revoke the existing pairing, generate a new short code, and display it for the user to enter in the Agent

#### Scenario: Automatic re-pair prompt on identity mismatch
- **WHEN** a Level 1 or Level 2 verification fails during reconnection
- **THEN** the Desktop SHALL display a notification explaining the mismatch and offering a "Re-pair" action button
