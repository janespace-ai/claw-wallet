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
The system SHALL maintain a queue of transactions pending manual approval. The Signer process SHALL handle its own authorization (Allowance-based), while the application-layer Policy Engine continues to enforce spending limits and whitelist rules.

#### Scenario: Approve pending transaction
- **WHEN** user invokes `wallet_approval_approve` with a transaction ID
- **THEN** the system retrieves the queued transaction, sends it to the Signer for signing (which may auto-sign if within Allowance, or prompt user), broadcasts, and returns the result

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

### Requirement: Dual-layer policy enforcement
The system SHALL enforce policies at two independent layers: the application-layer Policy Engine (in the Tool process) and the Signer-layer Allowance (in the Signer process).

#### Scenario: Both layers must pass
- **WHEN** a transaction is submitted
- **THEN** it SHALL first pass the application-layer Policy Engine checks (per-tx limit, daily limit, whitelist), and then the Signer SHALL independently evaluate its Allowance policy before signing

#### Scenario: Application layer blocks, Signer not reached
- **WHEN** the application-layer Policy Engine blocks a transaction (e.g., exceeds daily limit)
- **THEN** the transaction SHALL be queued for approval in the Policy Engine without ever reaching the Signer

#### Scenario: Application layer passes, Signer blocks
- **WHEN** the application-layer Policy Engine approves a transaction but the Signer's Allowance policy rejects it (e.g., unknown recipient)
- **THEN** the Signer SHALL prompt the user for confirmation, and if the user rejects, the Tool SHALL return a "user rejected" error
