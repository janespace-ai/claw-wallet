## MODIFIED Requirements

### Requirement: X25519 ECDH key exchange
The system SHALL use X25519 Elliptic Curve Diffie-Hellman for establishing shared secrets, with support for both persistent and ephemeral key pairs.

#### Scenario: Persistent key pair generation
- **WHEN** a device does not have a persisted communication key pair on startup
- **THEN** it SHALL generate a new X25519 key pair and persist it to disk (encrypted on Desktop, plaintext with 0600 on Agent)

#### Scenario: Persistent key pair loading
- **WHEN** a device starts and a persisted communication key pair exists
- **THEN** it SHALL load the existing key pair instead of generating a new one

#### Scenario: Shared secret derivation
- **WHEN** both parties have received each other's X25519 public key
- **THEN** each party SHALL derive the same 32-byte shared secret using X25519 ECDH, and SHALL use HKDF-SHA256 to derive the AES-256-GCM encryption key

#### Scenario: Key material cleanup
- **WHEN** the shared secret and encryption key have been derived
- **THEN** the raw shared secret SHALL be zeroed from memory; the persistent private key SHALL remain in memory for future reconnections

### Requirement: WebSocket transport with auto-reconnect
The E2EE channel SHALL use WebSocket as the transport layer with automatic reconnection and identity verification.

#### Scenario: Connection established
- **WHEN** both parties connect to the Relay with the same pairId
- **THEN** a bidirectional WebSocket channel SHALL be established for E2EE message exchange

#### Scenario: Connection lost
- **WHEN** the WebSocket connection drops (network interruption, Relay restart)
- **THEN** both parties SHALL attempt reconnection with exponential backoff (starting at 1 second, max 30 seconds)

#### Scenario: Reconnection with identity handshake
- **WHEN** a reconnection is established after a drop
- **THEN** the parties SHALL perform an E2EE handshake carrying their persistent public keys and machineId, and the receiving side SHALL verify identity before establishing the session

#### Scenario: Handshake message includes identity metadata
- **WHEN** a handshake message is sent during reconnection
- **THEN** the message SHALL include `publicKey` (hex), `machineId` (hash), and `reconnect: true`
