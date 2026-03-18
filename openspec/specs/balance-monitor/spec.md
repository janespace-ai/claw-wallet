## ADDED Requirements

### Requirement: Periodic balance polling
The system SHALL periodically query the blockchain for balance changes on the configured wallet address.

#### Scenario: Detect incoming transfer via polling
- **WHEN** the balance monitor detects that the wallet's USDC balance has increased since the last poll
- **THEN** the system SHALL record the change and trigger a notification through OpenClaw's messaging channel

#### Scenario: Configurable poll interval
- **WHEN** user sets the poll interval to 60 seconds in configuration
- **THEN** the system SHALL query the blockchain every 60 seconds instead of the default 30 seconds

#### Scenario: Monitor starts with plugin
- **WHEN** the OpenClaw wallet plugin is loaded
- **THEN** the balance monitor SHALL start polling automatically

#### Scenario: Monitor stops with plugin
- **WHEN** the OpenClaw wallet plugin is unloaded
- **THEN** the balance monitor SHALL stop polling and clean up resources

### Requirement: Balance change notification
The system SHALL notify the user through OpenClaw's messaging channel when a balance change is detected.

#### Scenario: Incoming transfer notification
- **WHEN** an incoming transfer of 100 USDC is detected
- **THEN** the system sends a notification: "Received 100 USDC. New balance: 600 USDC" through the active messaging channel

#### Scenario: Outgoing transfer not double-notified
- **WHEN** a balance decrease is detected that matches a recently sent transaction
- **THEN** the system SHALL NOT send a separate notification (the send operation already confirmed the transaction)

### Requirement: Transaction history query
The system SHALL provide transaction history for the wallet.

#### Scenario: Query recent transactions
- **WHEN** user invokes `wallet_history` with a limit parameter
- **THEN** the system returns the most recent transactions (both sent and received) with details including hash, direction, amount, token, counterparty, timestamp, and status

#### Scenario: Local history cache
- **WHEN** the system queries transaction history
- **THEN** it SHALL cache results locally in `history.json` and serve from cache when possible, refreshing from chain/indexer when requested

### Requirement: Malicious RPC response handling
The system SHALL handle unexpected or malicious RPC responses without crashing or leaking data.

#### Scenario: RPC returns negative balance
- **WHEN** the RPC node returns a negative balance value
- **THEN** the system SHALL treat it as 0 or throw a validation error

#### Scenario: RPC returns extremely large balance
- **WHEN** the RPC returns a balance exceeding total supply (e.g., 2^256 - 1)
- **THEN** the system SHALL handle the BigInt without overflow

#### Scenario: RPC returns non-numeric balance
- **WHEN** the RPC returns a string instead of a number for balance
- **THEN** the system SHALL throw a clear error without exposing internal state
