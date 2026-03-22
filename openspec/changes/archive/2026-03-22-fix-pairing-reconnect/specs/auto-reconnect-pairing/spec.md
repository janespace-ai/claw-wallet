## MODIFIED Requirements

### Requirement: Automatic reconnection with identity verification
On reconnection, the Desktop Wallet SHALL perform three-level identity verification before restoring the E2EE session.

#### Scenario: Desktop reconnects with correct pairId on startup
- **WHEN** the Desktop Wallet starts and has paired devices with stored `agentPublicKey`
- **THEN** it SHALL derive the pairId using `derivePairId(walletAddress, agentPublicKey)` and connect to the Relay WebSocket using this derived pairId

#### Scenario: Desktop reconnects after pairing completion
- **WHEN** the Desktop completes a new pairing and stores the `agentPublicKey`
- **THEN** it SHALL immediately close any existing WebSocket connection and reconnect using the newly derived pairId

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
