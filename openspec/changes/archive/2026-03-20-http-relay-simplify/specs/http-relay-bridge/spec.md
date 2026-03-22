## ADDED Requirements

### Requirement: HTTP relay bridge endpoint
The Relay Server SHALL expose a `POST /relay/{pairId}` HTTP endpoint that accepts an E2EE-encrypted message from the Agent, forwards it to the WebSocket-connected Wallet for that pairId, and returns the Wallet's E2EE-encrypted response synchronously.

#### Scenario: Successful message relay
- **WHEN** the Agent sends `POST /relay/{pairId}` with a JSON body containing `{requestId, data}` and the Wallet is connected via WebSocket
- **THEN** the Relay SHALL forward the message to the Wallet's WebSocket, wait for a response with the matching `requestId`, and return it as the HTTP response with status 200

#### Scenario: Wallet not connected
- **WHEN** the Agent sends `POST /relay/{pairId}` but no WebSocket client is connected for that pairId
- **THEN** the Relay SHALL return HTTP 404 with `{"error": "no wallet connected for this pairId"}`

#### Scenario: Wallet response timeout
- **WHEN** the Wallet does not respond within the configured timeout (default 120 seconds)
- **THEN** the Relay SHALL return HTTP 504 with `{"error": "wallet response timeout"}`

#### Scenario: Request ID correlation
- **WHEN** multiple HTTP requests are in-flight for the same pairId with different requestIds
- **THEN** the Relay SHALL correctly route each Wallet response to the matching HTTP request based on `requestId`

### Requirement: HTTP relay source IP injection
The Relay SHALL inject the Agent's source IP into messages forwarded via the HTTP bridge, consistent with WebSocket source IP injection.

#### Scenario: Source IP added to forwarded message
- **WHEN** the Relay forwards an HTTP-originated message to the Wallet's WebSocket
- **THEN** the message SHALL be wrapped in the same envelope format as WebSocket messages: `{"sourceIP": "<agent-ip>", "data": <original-body>}`

### Requirement: HTTP relay rate limiting
The Relay SHALL enforce rate limits on the HTTP relay bridge endpoint.

#### Scenario: Rate limit exceeded
- **WHEN** a single IP sends more than 30 requests per minute to `POST /relay/{pairId}`
- **THEN** the Relay SHALL return HTTP 429

### Requirement: Pending request cleanup
The Relay SHALL clean up pending HTTP-to-WS bridge state on timeout, client disconnect, or handler exit.

#### Scenario: Timeout cleanup
- **WHEN** an HTTP relay request times out
- **THEN** the Relay SHALL remove the pending request entry from the Hub and return 504

#### Scenario: Wallet disconnects during pending request
- **WHEN** the Wallet disconnects while an HTTP relay request is pending
- **THEN** the Relay SHALL return HTTP 502 with `{"error": "wallet disconnected"}`
