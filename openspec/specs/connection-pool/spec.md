# connection-pool Specification

## Purpose
TBD - created by archiving change multi-account-multi-network. Update Purpose after archive.
## Requirements
### Requirement: Maintain up to 10 concurrent WebSocket connections

The system SHALL maintain simultaneous WebSocket connections for up to 10 accounts, each with independent connection state and encryption session.

#### Scenario: Initial connection establishment
- **WHEN** user unlocks wallet with 3 accounts created
- **THEN** system establishes 3 WebSocket connections to Relay Server, one per account

#### Scenario: New account connection
- **WHEN** user creates 4th account
- **THEN** system immediately establishes WebSocket connection for Account 3 without disconnecting existing connections

#### Scenario: Maximum connections
- **WHEN** 10 accounts exist with active connections
- **THEN** system maintains all 10 WebSocket connections simultaneously

#### Scenario: Connection-per-account mapping
- **WHEN** message arrives on WebSocket for Account 2
- **THEN** system routes message to Account 2's message handler, not other accounts

### Requirement: Automatic reconnection on connection loss

The system SHALL automatically reconnect WebSocket connections that fail or disconnect, using exponential backoff strategy.

#### Scenario: Single connection failure
- **WHEN** WebSocket connection for Account 1 drops
- **THEN** system attempts reconnection after 5 seconds, then 10s, 30s, 60s, capping at 60s intervals

#### Scenario: Reconnection success
- **WHEN** reconnection attempt succeeds
- **THEN** system resets backoff timer and resumes normal operation for that account

#### Scenario: All connections offline
- **WHEN** network connectivity is lost
- **THEN** system shows "Disconnected" status and attempts to reconnect all accounts with staggered timing (0s, 1s, 2s offsets)

### Requirement: Connection health monitoring

The system SHALL monitor each WebSocket connection's health using ping/pong mechanism every 30 seconds.

#### Scenario: Healthy connection
- **WHEN** WebSocket receives pong response within 5 seconds of ping
- **THEN** system marks connection as healthy and continues normal operation

#### Scenario: Unresponsive connection
- **WHEN** WebSocket does not respond to 3 consecutive pings
- **THEN** system closes connection and initiates reconnection sequence

#### Scenario: Connection health indicator
- **WHEN** user views connection status
- **THEN** UI displays per-account connection health: "Connected", "Reconnecting", "Disconnected"

### Requirement: Unique Pair ID per connection

The system SHALL use unique Pair ID for each account's WebSocket connection, derived from mnemonic and account index.

#### Scenario: Pair ID computation
- **WHEN** establishing connection for Account 3
- **THEN** system computes Pair ID and uses it for WebSocket handshake

#### Scenario: Pair ID persistence
- **WHEN** connection disconnects and reconnects
- **THEN** system uses same Pair ID, maintaining Agent association with that account

### Requirement: Connection resource limits

The system SHALL not exceed 10 WebSocket connections per Desktop instance, enforcing limit at Relay Server.

#### Scenario: Relay server connection limit
- **WHEN** Desktop attempts 11th WebSocket connection from same IP
- **THEN** Relay Server rejects with HTTP 429 "Too many connections from this IP"

#### Scenario: Connection limit error handling
- **WHEN** connection rejected due to limit
- **THEN** Desktop shows error "Maximum connections reached (10 accounts)"

### Requirement: Graceful shutdown

The system SHALL cleanly close all WebSocket connections when application exits.

#### Scenario: Application quit
- **WHEN** user quits Desktop application
- **THEN** system sends close frame to all WebSocket connections before exiting

#### Scenario: Connection cleanup timeout
- **WHEN** WebSocket close takes over 3 seconds
- **THEN** system forcibly terminates connection and exits application

