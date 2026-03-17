## ADDED Requirements

### Requirement: Per-transaction spending limit
The system SHALL enforce a maximum amount per single transaction.

#### Scenario: Transaction within limit
- **WHEN** a transaction of 50 USDC is requested and the per-transaction limit is 500 USDC
- **THEN** the transaction SHALL be allowed to proceed

#### Scenario: Transaction exceeds limit
- **WHEN** a transaction of 1000 USDC is requested and the per-transaction limit is 500 USDC
- **THEN** the transaction SHALL be rejected and queued for manual approval with a notification to the user

### Requirement: Daily cumulative spending limit
The system SHALL enforce a maximum total spending amount per 24-hour rolling window.

#### Scenario: Daily limit not reached
- **WHEN** today's cumulative spending is 200 USDC and a new 100 USDC transaction is requested, with a daily limit of 1000 USDC
- **THEN** the transaction SHALL be allowed

#### Scenario: Daily limit exceeded
- **WHEN** today's cumulative spending is 900 USDC and a new 200 USDC transaction is requested, with a daily limit of 1000 USDC
- **THEN** the transaction SHALL be rejected and queued for manual approval

### Requirement: Address whitelist
The system SHALL maintain a whitelist of trusted recipient addresses.

#### Scenario: Transfer to whitelisted address
- **WHEN** a transfer is requested to an address on the whitelist
- **THEN** the transaction proceeds through normal limit checks without additional confirmation

#### Scenario: Transfer to unknown address in supervised mode
- **WHEN** a transfer is requested to an address NOT on the whitelist and the policy mode is "supervised"
- **THEN** the transaction SHALL be queued for manual approval regardless of amount

#### Scenario: Transfer to unknown address in autonomous mode
- **WHEN** a transfer is requested to an address NOT on the whitelist and the policy mode is "autonomous"
- **THEN** the transaction SHALL proceed if within spending limits but the user SHALL be notified

### Requirement: Approval queue
The system SHALL maintain a queue of transactions pending manual approval.

#### Scenario: Approve pending transaction
- **WHEN** user invokes `wallet_approval_approve` with a transaction ID
- **THEN** the system signs and broadcasts the queued transaction and returns the result

#### Scenario: Reject pending transaction
- **WHEN** user invokes `wallet_approval_reject` with a transaction ID
- **THEN** the system removes the transaction from the queue and records the rejection

#### Scenario: Approval timeout
- **WHEN** a queued transaction is not approved within 24 hours
- **THEN** the system SHALL automatically reject it and notify the user

#### Scenario: List pending approvals
- **WHEN** user invokes `wallet_approval_list`
- **THEN** the system returns all pending transactions with details (recipient, amount, token, reason for approval, timestamp)

### Requirement: Policy configuration
The system SHALL allow users to view and update policy settings.

#### Scenario: View current policy
- **WHEN** user invokes `wallet_policy_get`
- **THEN** the system returns current policy settings including per-transaction limit, daily limit, whitelist, and mode (supervised/autonomous)

#### Scenario: Update policy settings
- **WHEN** user invokes `wallet_policy_set` with new limit values or mode
- **THEN** the system updates the policy configuration and persists it to `policy.json`

### Requirement: Default policy
The system SHALL apply sensible default policies on first setup.

#### Scenario: First-time defaults
- **WHEN** a wallet is created and no policy.json exists
- **THEN** the system SHALL create a default policy with per-transaction limit of 100 USD equivalent, daily limit of 500 USD equivalent, empty whitelist, and "supervised" mode
