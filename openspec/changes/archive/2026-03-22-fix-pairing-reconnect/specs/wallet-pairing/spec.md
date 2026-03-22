## MODIFIED Requirements

### Requirement: Short code pairing protocol
The system SHALL support pairing between the Electron App and Agent Signer using Relay-assisted short codes that can be communicated via copy-paste or verbal exchange.

#### Scenario: Electron App generates pairing code
- **WHEN** user clicks "Generate Pairing Code" in the Electron App
- **THEN** the App SHALL generate an X25519 key pair, send the public key and wallet address to the Relay via POST /pair/create, receive an 8-character short code, display it to the user, and connect to the Relay WebSocket with a temporary pairId

#### Scenario: Agent Signer resolves pairing code
- **WHEN** the Agent invokes `wallet_pair` with a short code (e.g., "PAIR-ABCD-EFGH")
- **THEN** the Signer SHALL send GET /pair/{shortCode} to the Relay, receive the Electron App's public key and wallet address, generate its own X25519 key pair, and attempt to send a `pair_complete` message via HTTP relay

#### Scenario: Pairing confirmation on Electron App
- **WHEN** the Agent Signer sends a `pair_complete` message
- **THEN** the Electron App SHALL store the Agent's device info, derive the real pairId, close the current WebSocket connection, and reconnect using the derived pairId

#### Scenario: Pairing code expired
- **WHEN** a short code is used after 10 minutes
- **THEN** the Agent Signer SHALL receive an error and the user SHALL be instructed to generate a new pairing code

#### Scenario: Agent pair_complete delivery failure is non-fatal
- **WHEN** the Agent's `pair_complete` message fails to reach the Desktop (e.g., Desktop not yet connected with matching pairId)
- **THEN** the Agent SHALL consider the pairing successful based on short code resolution, and the Desktop SHALL establish the correct WebSocket connection when it processes the pairing data on next connect
