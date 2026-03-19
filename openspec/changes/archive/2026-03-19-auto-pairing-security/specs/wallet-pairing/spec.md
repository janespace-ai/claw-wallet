## MODIFIED Requirements

### Requirement: Pairing data persistence
The system SHALL persist pairing information securely so that paired devices can reconnect after restarts.

#### Scenario: Pairing info saved on Electron App
- **WHEN** pairing completes successfully
- **THEN** the Electron App SHALL save: Agent's communication public key, pairId, device fingerprint (machineId), trusted IP, pairing timestamp — encrypted with the wallet password

#### Scenario: Pairing info saved on Agent Signer
- **WHEN** pairing completes successfully
- **THEN** the Agent Signer SHALL save: Electron App's communication public key, pairId, wallet address, Agent's own communication key pair (public + private) — to a local config file with 0600 permissions

#### Scenario: Reconnection after restart
- **WHEN** both the Electron App and Agent Signer restart
- **THEN** they SHALL reconnect to the Relay using the deterministically derived pairId and perform an identity-verified E2EE handshake using their persisted communication keys, without requiring user intervention

#### Scenario: Forced re-pairing on identity mismatch
- **WHEN** reconnection identity verification fails (public key or machineId mismatch)
- **THEN** the Desktop SHALL freeze the session and require the user to initiate a new pairing via short code
