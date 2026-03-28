## ADDED Requirements

### Requirement: Persist all signing decisions
Desktop SHALL store every signing decision (auto-approved, manual approval, rejection) in a local database with timestamp.

#### Scenario: Record auto-approved transaction
- **WHEN** transaction is auto-approved within budget
- **THEN** system stores record with type="auto", timestamp, and transaction details

#### Scenario: Record manual approval
- **WHEN** user manually approves transaction via modal
- **THEN** system stores record with type="manual", timestamp, and transaction details

#### Scenario: Record rejection
- **WHEN** user rejects transaction via modal
- **THEN** system stores record with type="rejected", timestamp, and transaction details

### Requirement: Store comprehensive signing metadata
Each signing record SHALL include: requestId, timestamp, approval type, transaction method, recipient address, value, token, chain, estimated USD value, and transaction hash (if available).

#### Scenario: Store complete transaction metadata
- **WHEN** recording a signing decision
- **THEN** system stores all fields: requestId, timestamp, type, method, to, value, token, chain, estimatedUSD, txHash

### Requirement: Display signing history in reverse chronological order
Desktop SHALL display signing history sorted by timestamp descending (most recent first).

#### Scenario: Display recent signings first
- **WHEN** viewing signing history with 10 records
- **THEN** most recent signing appears at the top of the list

### Requirement: Distinguish approval types visually
Desktop SHALL display different visual indicators for auto-approved (🤖), manually approved (👤), and rejected (❌) transactions.

#### Scenario: Display auto-approval indicator
- **WHEN** transaction type is "auto"
- **THEN** display shows "🤖 Auto" badge

#### Scenario: Display manual approval indicator
- **WHEN** transaction type is "manual"
- **THEN** display shows "👤 Manual" badge

#### Scenario: Display rejection indicator
- **WHEN** transaction type is "rejected"
- **THEN** display shows "❌ Rejected" badge

### Requirement: Store signing history persistently
Signing history SHALL persist across Desktop restarts and be stored in the user data directory.

#### Scenario: History persists after restart
- **WHEN** Desktop is closed and reopened
- **THEN** all previously recorded signing decisions are still visible

### Requirement: Support unlimited history retention
Signing history SHALL retain all records indefinitely without automatic pruning (user may manually clear if needed).

#### Scenario: Display old signing records
- **WHEN** viewing history with records from months ago
- **THEN** all historical records are displayed in the list
