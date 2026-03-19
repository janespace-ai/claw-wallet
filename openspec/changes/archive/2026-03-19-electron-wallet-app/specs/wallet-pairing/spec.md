## ADDED Requirements

### Requirement: Short code pairing protocol
The system SHALL support pairing between the Electron App and Agent Signer using Relay-assisted short codes that can be communicated via copy-paste or verbal exchange.

#### Scenario: Electron App generates pairing code
- **WHEN** user clicks "Generate Pairing Code" in the Electron App
- **THEN** the App SHALL generate an X25519 key pair, send the public key and wallet address to the Relay via POST /pair/create, receive an 8-character short code, and display it to the user

#### Scenario: Agent Signer resolves pairing code
- **WHEN** the Agent invokes `wallet_pair` with a short code (e.g., "PAIR-ABCD-EFGH")
- **THEN** the Signer SHALL send GET /pair/{shortCode} to the Relay, receive the Electron App's public key and wallet address, generate its own X25519 key pair, and initiate the E2EE handshake

#### Scenario: Pairing confirmation on Electron App
- **WHEN** the Agent Signer initiates the handshake
- **THEN** the Electron App SHALL display a confirmation dialog showing the Agent's device info (hostname, IP) and require user approval (biometric or password) before completing the pairing

#### Scenario: Pairing code expired
- **WHEN** a short code is used after 10 minutes
- **THEN** the Agent Signer SHALL receive an error and the user SHALL be instructed to generate a new pairing code

### Requirement: Pairing data persistence
The system SHALL persist pairing information securely so that paired devices can reconnect after restarts.

#### Scenario: Pairing info saved on Electron App
- **WHEN** pairing completes successfully
- **THEN** the Electron App SHALL save: Agent's communication public key, pairId, device fingerprint, trusted IP, pairing timestamp — encrypted with the wallet password

#### Scenario: Pairing info saved on Agent Signer
- **WHEN** pairing completes successfully
- **THEN** the Agent Signer SHALL save: Electron App's communication public key, pairId, wallet address — to a local config file with 0600 permissions

#### Scenario: Reconnection after restart
- **WHEN** both the Electron App and Agent Signer restart
- **THEN** they SHALL reconnect to the Relay using the stored pairId and perform a fresh E2EE handshake using their persisted communication keys

### Requirement: Pairing management
The Electron App SHALL allow users to view and revoke paired devices.

#### Scenario: View paired devices
- **WHEN** user opens the "Paired Devices" settings
- **THEN** the App SHALL display a list of paired Agents with: hostname, IP address, pairing date, last seen time, and connection status

#### Scenario: Revoke pairing
- **WHEN** user selects "Revoke" for a paired Agent
- **THEN** the App SHALL delete the pairing info, disconnect the WebSocket, and the revoked Agent SHALL no longer be able to request signatures

#### Scenario: Revocation requires authentication
- **WHEN** user attempts to revoke a pairing
- **THEN** the App SHALL require biometric or password confirmation before proceeding
