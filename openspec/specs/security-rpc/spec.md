## ADDED Requirements

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

### Requirement: RPC timeout protection
RPC calls SHALL have timeout limits to prevent hanging.

#### Scenario: RPC endpoint unresponsive
- **WHEN** the RPC endpoint does not respond within 30 seconds
- **THEN** the system SHALL timeout and return an error

### Requirement: Gas estimation sanity check
Gas estimates from RPC SHALL be validated for reasonableness.

#### Scenario: Absurdly high gas estimate
- **WHEN** the RPC returns a gas estimate exceeding 30,000,000 (block gas limit)
- **THEN** the system SHALL warn or reject the transaction

#### Scenario: Zero gas estimate
- **WHEN** the RPC returns a gas estimate of 0
- **THEN** the system SHALL reject the estimate and return an error

### Requirement: Transaction broadcast verification
After broadcasting, the system SHALL verify the transaction was accepted.

#### Scenario: Transaction rejected by network
- **WHEN** `sendRawTransaction` is rejected by the RPC node
- **THEN** the system SHALL return a clear error with the rejection reason

#### Scenario: Receipt indicates failure
- **WHEN** the transaction receipt shows `status: "reverted"`
- **THEN** the system SHALL record the failure and return the revert reason if available
