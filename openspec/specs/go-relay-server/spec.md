## ADDED Requirements

### Requirement: Relay WebSocket message routing
The Relay Server SHALL accept WebSocket connections and route E2EE messages between paired clients by pairId. The Relay SHALL NOT decrypt, inspect, or store message payloads.

#### Scenario: Two clients connect with same pairId
- **WHEN** Client A (Agent Signer) and Client B (Electron App) both connect to the Relay with the same pairId
- **THEN** the Relay SHALL forward messages from A to B and from B to A in real-time

#### Scenario: Message forwarding preserves payload
- **WHEN** Client A sends an encrypted message through the Relay
- **THEN** the Relay SHALL forward the exact payload bytes to Client B without modification (except injecting sourceIP metadata)

#### Scenario: Client disconnects
- **WHEN** one client disconnects
- **THEN** the Relay SHALL notify the other client of the disconnection and SHALL NOT retain any queued messages

### Requirement: Short code pairing cache
The Relay SHALL provide HTTP endpoints for creating and resolving short pairing codes with automatic expiration.

#### Scenario: Create pairing code
- **WHEN** Electron App sends POST /pair/create with wallet address and communication public key
- **THEN** the Relay SHALL generate an 8-character alphanumeric short code, store the mapping in memory with a 10-minute TTL, and return the short code

#### Scenario: Resolve pairing code
- **WHEN** Agent Signer sends GET /pair/{shortCode}
- **THEN** the Relay SHALL return the stored pairing information (wallet address, communication public key) if the code is valid and not expired

#### Scenario: Expired pairing code
- **WHEN** a short code is resolved after 10 minutes
- **THEN** the Relay SHALL return a 404 error and the expired entry SHALL have been removed from memory

#### Scenario: Invalid pairing code
- **WHEN** a non-existent short code is resolved
- **THEN** the Relay SHALL return a 404 error

### Requirement: Source IP injection
The Relay SHALL inject the observed source IP address into forwarded WebSocket messages for client-side security monitoring.

#### Scenario: Message includes sourceIP
- **WHEN** the Relay forwards a message from Client A to Client B
- **THEN** the Relay SHALL add a `sourceIP` field containing Client A's observed public IP address

#### Scenario: sourceIP cannot be spoofed by client
- **WHEN** Client A includes a fake sourceIP in its message
- **THEN** the Relay SHALL overwrite it with the actual observed IP from the TCP connection

### Requirement: Relay rate limiting
The Relay SHALL enforce rate limits to prevent abuse.

#### Scenario: Pairing code creation rate limit
- **WHEN** a single IP creates more than 10 pairing codes within 1 minute
- **THEN** the Relay SHALL return HTTP 429 and reject further requests until the rate limit window resets

#### Scenario: WebSocket message rate limit
- **WHEN** a client sends more than 100 messages per second
- **THEN** the Relay SHALL drop excess messages and send a rate-limit warning to the client

### Requirement: Relay zero-persistence
The Relay SHALL NOT persist any data to disk. All state SHALL be held in memory only.

#### Scenario: Relay restart
- **WHEN** the Relay process restarts
- **THEN** all pairing codes and active sessions SHALL be cleared, and clients SHALL need to reconnect and re-pair

#### Scenario: No logging of message content
- **WHEN** the Relay forwards an encrypted message
- **THEN** the Relay SHALL NOT log the message payload, only metadata (sourceIP, pairId, timestamp, message size)
