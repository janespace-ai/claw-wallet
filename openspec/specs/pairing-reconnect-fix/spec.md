## ADDED Requirements

### Requirement: WebSocket reconnection after pairing completion
When the Desktop Wallet completes a new device pairing, it SHALL close the current WebSocket connection and reconnect using the correctly derived pairId so that the Agent's HTTP relay requests can be routed to it.

#### Scenario: Desktop reconnects with real pairId after first pairing
- **WHEN** Desktop receives and processes a `pair_complete` message from a newly paired Agent
- **THEN** Desktop SHALL close the existing WebSocket connection, derive the pairId from `walletAddress` and `agentPublicKey`, and open a new WebSocket connection to the Relay using `ws://<relay>/ws?pairId=<derivedPairId>`

#### Scenario: Agent relay requests succeed after Desktop reconnection
- **WHEN** Desktop has reconnected with the correct pairId after completing pairing
- **THEN** the Agent's `POST /relay/<pairId>` requests SHALL be forwarded to the Desktop via the WebSocket connection and receive a valid response

#### Scenario: Reconnection preserves existing sessions
- **WHEN** Desktop reconnects after pairing completion
- **THEN** all established E2EE sessions in the `sessions` Map SHALL be preserved across the reconnection

### Requirement: Pending pairId usage during pairing wait
The Desktop SHALL use a temporary `pending-` pairId only when no paired devices exist and a pairing code has been generated, and SHALL NOT use this pairId for any operational relay traffic.

#### Scenario: Desktop uses pending pairId while awaiting pairing
- **WHEN** Desktop generates a pairing code and has no existing paired devices
- **THEN** Desktop SHALL connect to the Relay WebSocket using `pending-{timestamp}` pairId to maintain connectivity

#### Scenario: Pending pairId replaced after pairing
- **WHEN** a pairing completes successfully
- **THEN** the `pending-` pairId WebSocket connection SHALL be replaced with a connection using the real derived pairId within 1 second
