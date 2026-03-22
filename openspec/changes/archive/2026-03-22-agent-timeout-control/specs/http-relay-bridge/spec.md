## MODIFIED Requirements

### Requirement: HTTP relay endpoint timeout
The `POST /relay/:pairId` endpoint SHALL accept an optional `timeout` field (integer, seconds) in the JSON request body. The value SHALL be clamped to the range 5–600. If omitted, the default timeout SHALL be 30 seconds. The `SendAndWait` method SHALL use this client-specified timeout instead of a hardcoded value.

#### Scenario: Client specifies timeout within range
- **WHEN** Agent sends `POST /relay/:pairId` with body `{"requestId":"r1","timeout":120,"data":{...}}`
- **THEN** Relay Server calls `SendAndWait` with a 120-second timeout

#### Scenario: Client specifies timeout below minimum
- **WHEN** Agent sends `POST /relay/:pairId` with body `{"requestId":"r1","timeout":2,"data":{...}}`
- **THEN** Relay Server clamps timeout to 5 seconds

#### Scenario: Client specifies timeout above maximum
- **WHEN** Agent sends `POST /relay/:pairId` with body `{"requestId":"r1","timeout":900,"data":{...}}`
- **THEN** Relay Server clamps timeout to 600 seconds

#### Scenario: Client omits timeout
- **WHEN** Agent sends `POST /relay/:pairId` with body `{"requestId":"r1","data":{...}}` (no timeout field)
- **THEN** Relay Server uses default timeout of 30 seconds
