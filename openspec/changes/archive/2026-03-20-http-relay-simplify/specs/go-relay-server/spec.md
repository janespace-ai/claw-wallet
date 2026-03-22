## ADDED Requirements

### Requirement: HTTP-to-WebSocket bridge in Hub
The Relay Hub SHALL support sending a message to a WebSocket client and waiting for a correlated response, enabling the `POST /relay/{pairId}` HTTP endpoint.

#### Scenario: SendAndWait with connected peer
- **WHEN** `SendAndWait(pairId, message, timeout)` is called and a WebSocket client is connected for that pairId
- **THEN** the Hub SHALL send the message to the WebSocket client's Send channel and block until a response with the matching `requestId` arrives or timeout occurs

#### Scenario: SendAndWait with no connected peer
- **WHEN** `SendAndWait` is called but no WebSocket client is connected for the given pairId
- **THEN** the Hub SHALL return an error immediately

#### Scenario: Response routing by requestId
- **WHEN** a WebSocket client sends a message containing a `requestId` that matches a pending HTTP bridge request
- **THEN** the Hub SHALL route the message to the waiting HTTP handler instead of broadcasting to other WebSocket peers

## MODIFIED Requirements

### Requirement: Relay WebSocket message routing
The Relay Server SHALL use the Hertz HTTP framework with the hertz-contrib/websocket extension to accept WebSocket connections and route E2EE messages between paired clients by pairId. The Relay SHALL NOT decrypt, inspect, or store message payloads. Additionally, the Relay SHALL check incoming WebSocket messages for pending HTTP bridge `requestId` matches before performing the standard fan-out broadcast.

#### Scenario: Two clients connect with same pairId
- **WHEN** Client A (Agent Signer) and Client B (Electron App) both connect to the Relay with the same pairId
- **THEN** the Relay SHALL forward messages from A to B and from B to A in real-time

#### Scenario: Message forwarding preserves payload
- **WHEN** Client A sends an encrypted message through the Relay
- **THEN** the Relay SHALL forward the exact payload bytes to Client B without modification (except injecting sourceIP metadata)

#### Scenario: Client disconnects
- **WHEN** one client disconnects
- **THEN** the Relay SHALL notify the other client of the disconnection and SHALL NOT retain any queued messages

#### Scenario: WebSocket response matches pending HTTP request
- **WHEN** a WebSocket client sends a message and the data payload contains a `requestId` that matches a pending HTTP bridge request
- **THEN** the Relay SHALL deliver the message to the pending HTTP handler and SHALL NOT fan-out the message to other WebSocket peers
