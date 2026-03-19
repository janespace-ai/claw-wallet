## ADDED Requirements

### Requirement: Per-pairId IP binding
The Relay SHALL track the distinct source IPs connected per pairId and reject connections that would exceed the expected participant count.

#### Scenario: Two IPs connected to same pairId
- **WHEN** two clients from different IPs connect with the same pairId
- **THEN** the Relay SHALL allow both connections (one Agent, one Desktop)

#### Scenario: Third IP attempts to join existing pairId
- **WHEN** a third distinct IP attempts to connect with a pairId that already has 2 distinct IPs connected
- **THEN** the Relay SHALL reject the connection with a WebSocket close code 4003 and reason "pair IP limit exceeded"

#### Scenario: IP slot freed after disconnect
- **WHEN** a client disconnects from a pairId
- **THEN** the Relay SHALL remove that client's IP from the tracked set, freeing the slot for a new connection

### Requirement: Per-pairId connection rate limit
The Relay SHALL enforce a connection rate limit per pairId to prevent rapid reconnection abuse.

#### Scenario: Normal reconnection rate
- **WHEN** a client reconnects to a pairId at a rate of 10 or fewer new connections per minute
- **THEN** the Relay SHALL allow the connections

#### Scenario: Excessive reconnection rate
- **WHEN** a pairId receives more than 10 new WebSocket connection attempts within 1 minute
- **THEN** the Relay SHALL reject subsequent connections with WebSocket close code 4029 and reason "connection rate limit exceeded" until the rate window resets

### Requirement: PairId connection metadata logging
The Relay SHALL log connection metadata per pairId for operational visibility without persisting it to disk.

#### Scenario: Connection event logged
- **WHEN** a client connects or disconnects from a pairId
- **THEN** the Relay SHALL log the event with: pairId (truncated to 8 chars), action (connect/disconnect), source IP, and current active connection count for that pairId
