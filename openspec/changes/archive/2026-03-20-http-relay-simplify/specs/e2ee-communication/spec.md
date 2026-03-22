## MODIFIED Requirements

### Requirement: WebSocket transport with auto-reconnect
The E2EE channel SHALL support two transport modes: WebSocket (for Wallet-side persistent connections) and HTTP (for Agent-side stateless requests). The Agent SHALL use HTTP transport via the Relay's `POST /relay/{pairId}` endpoint. The Desktop Wallet SHALL continue using WebSocket transport with auto-reconnect.

#### Scenario: Agent sends message via HTTP
- **WHEN** the Agent needs to send an E2EE message to the Wallet
- **THEN** the Agent SHALL encrypt the message using its stored session credentials, send it via `POST /relay/{pairId}` to the Relay Server, and decrypt the response

#### Scenario: Desktop Wallet uses WebSocket (unchanged)
- **WHEN** the Desktop Wallet connects to the Relay
- **THEN** it SHALL use WebSocket with auto-reconnect and exponential backoff as before

#### Scenario: Agent E2EE session from stored pairing
- **WHEN** the Agent sends a request and a pairing exists in local storage
- **THEN** the Agent SHALL derive the E2EE session key from the stored X25519 keypair and peer public key, encrypt the request, and destroy the session after receiving the response

#### Scenario: Initial pairing handshake via HTTP
- **WHEN** the Agent performs initial pairing with a short code
- **THEN** the Agent SHALL resolve the short code via `GET /pair/{code}`, derive the pairId and session key, and send the `pair_complete` message via the HTTP relay bridge
