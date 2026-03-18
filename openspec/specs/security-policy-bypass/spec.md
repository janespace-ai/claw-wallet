## ADDED Requirements

### Requirement: Floating-point precision attack resistance
The policy engine SHALL NOT be bypassable via floating-point precision exploits.

#### Scenario: Many small transactions bypass daily limit
- **WHEN** 1000 transactions of $0.501 each are submitted (total $501, limit $500)
- **THEN** the policy engine SHALL correctly accumulate and block at the limit boundary

#### Scenario: Precision edge case
- **WHEN** transactions of $0.1 + $0.2 are submitted
- **THEN** the cumulative total SHALL be exactly $0.3 (not $0.30000000000000004)

### Requirement: Concurrent transaction safety
The policy engine SHALL correctly enforce limits under concurrent transaction attempts.

#### Scenario: Parallel transactions exceeding limit
- **WHEN** two $90 transactions are submitted simultaneously (limit $100/tx, daily $500)
- **THEN** both SHALL be checked against the limit individually and the daily total SHALL reflect both

### Requirement: Time window manipulation resistance
The daily limit rolling window SHALL NOT be manipulable.

#### Scenario: System clock change
- **WHEN** daily spending records exist and the system clock is set back 25 hours
- **THEN** expired records SHALL be cleaned based on stored timestamps, not manipulable clocks

### Requirement: Approval ID unpredictability
Approval IDs SHALL be cryptographically random and not enumerable.

#### Scenario: Approval IDs are random
- **WHEN** 100 approval IDs are generated
- **THEN** they SHALL all be unique and not sequential

#### Scenario: Invalid approval ID rejected
- **WHEN** `approve()` is called with a fabricated ID
- **THEN** the system SHALL return null without side effects

### Requirement: Whitelist bypass prevention
The whitelist check SHALL NOT be bypassable via case manipulation or encoding tricks.

#### Scenario: Mixed-case address bypass attempt
- **WHEN** address "0xAABB..." is whitelisted and transaction targets "0xaabb..."
- **THEN** the system SHALL recognize them as the same address (case-insensitive comparison)

#### Scenario: Address with leading zeros
- **WHEN** a whitelisted address has leading zeros
- **THEN** the comparison SHALL still match correctly
