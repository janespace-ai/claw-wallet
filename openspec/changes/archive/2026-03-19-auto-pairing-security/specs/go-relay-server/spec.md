## ADDED Requirements

### Requirement: Per-pairId IP tracking
The Relay SHALL track distinct source IPs per pairId in the WebSocket hub and enforce a maximum of 2 simultaneous distinct IPs.

#### Scenario: Register with IP tracking
- **WHEN** a client connects with a pairId
- **THEN** the Relay SHALL record the client's source IP in the per-pairId IP set

#### Scenario: Reject third distinct IP
- **WHEN** a client from a third distinct IP attempts to connect to a pairId that already has 2 distinct IPs
- **THEN** the Relay SHALL close the connection with code 4003 and reason "pair IP limit exceeded"

#### Scenario: Unregister cleans up IP tracking
- **WHEN** a client disconnects and no other clients from the same IP remain for that pairId
- **THEN** the Relay SHALL remove that IP from the per-pairId IP set

### Requirement: Per-pairId WebSocket connection rate limit
The Relay SHALL enforce a rate limit on new WebSocket connections per pairId.

#### Scenario: Connection rate within limit
- **WHEN** a pairId receives 10 or fewer new connections per minute
- **THEN** the Relay SHALL allow all connections

#### Scenario: Connection rate exceeded
- **WHEN** a pairId receives more than 10 new connections within 1 minute
- **THEN** the Relay SHALL reject the connection with close code 4029 and reason "connection rate limit exceeded"
