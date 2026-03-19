## ADDED Requirements

### Requirement: X25519 ECDH key exchange
The system SHALL use X25519 Elliptic Curve Diffie-Hellman for establishing shared secrets during pairing.

#### Scenario: Key pair generation
- **WHEN** a new pairing session is initiated
- **THEN** both the Electron App and the Agent Signer SHALL generate ephemeral X25519 key pairs and exchange public keys through the Relay

#### Scenario: Shared secret derivation
- **WHEN** both parties have received each other's X25519 public key
- **THEN** each party SHALL derive the same 32-byte shared secret using X25519 ECDH, and SHALL use HKDF-SHA256 to derive the AES-256-GCM encryption key

#### Scenario: Key material cleanup
- **WHEN** the shared secret and encryption key have been derived
- **THEN** the ephemeral X25519 private key SHALL be zeroed from memory

### Requirement: AES-256-GCM message encryption
All messages between the Agent Signer and Electron App SHALL be encrypted using AES-256-GCM with the derived shared key.

#### Scenario: Message encryption
- **WHEN** a party sends a message through the E2EE channel
- **THEN** the message SHALL be encrypted with AES-256-GCM using a unique 12-byte nonce per message and the shared AES key

#### Scenario: Message decryption
- **WHEN** an encrypted message is received
- **THEN** the receiving party SHALL decrypt it using AES-256-GCM and verify the authentication tag; if verification fails, the message SHALL be rejected

#### Scenario: Nonce uniqueness
- **WHEN** multiple messages are sent in a session
- **THEN** each message SHALL use a strictly incrementing nonce counter to guarantee uniqueness and prevent replay

### Requirement: Anti-replay protection
The E2EE channel SHALL prevent message replay attacks using monotonically increasing sequence numbers.

#### Scenario: Duplicate sequence number
- **WHEN** a message is received with a sequence number equal to or less than the last processed sequence number
- **THEN** the receiving party SHALL reject the message and log a security warning

#### Scenario: Sequence gap detection
- **WHEN** a message is received with a sequence number more than 100 ahead of the last processed sequence number
- **THEN** the receiving party SHALL reject the message as potentially spoofed

### Requirement: WebSocket transport with auto-reconnect
The E2EE channel SHALL use WebSocket as the transport layer with automatic reconnection.

#### Scenario: Connection established
- **WHEN** both parties connect to the Relay with the same pairId
- **THEN** a bidirectional WebSocket channel SHALL be established for E2EE message exchange

#### Scenario: Connection lost
- **WHEN** the WebSocket connection drops (network interruption, Relay restart)
- **THEN** both parties SHALL attempt reconnection with exponential backoff (starting at 1 second, max 30 seconds)

#### Scenario: Reconnection re-handshake
- **WHEN** a reconnection is established after a drop
- **THEN** the parties SHALL perform a fresh E2EE handshake with new ephemeral keys and reset sequence counters
