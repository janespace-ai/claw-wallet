### Requirement: Allowance policy definition
The Signer SHALL maintain an AllowancePolicy that defines the boundaries for automatic (Level 0) transaction signing. Transactions exceeding allowance SHALL require re-authentication regardless of session state.

#### Scenario: Default allowance policy
- **WHEN** the Signer starts for the first time with no existing allowance configuration
- **THEN** the default policy SHALL be: `maxPerTxUsd: 100, maxDailyUsd: 500, allowedTokens: ["ETH", "USDC", "USDT"], allowedRecipients: []` (empty = whitelist from policy engine), `enabled: true`

#### Scenario: Custom allowance policy
- **WHEN** the user sets a custom allowance via `set_allowance` (with Level 2 approval)
- **THEN** the Signer SHALL persist the updated policy and use it for subsequent signing requests

#### Scenario: Transaction exceeding allowance requires re-auth
- **WHEN** a transaction exceeds the per-transaction limit or would exceed the daily cumulative limit
- **THEN** the Signer SHALL escalate to Level 1 or Level 2 and SHALL require user interaction through the AuthProvider, bypassing any active session for Level 2

### Requirement: Per-transaction limit check
The Signer SHALL reject auto-signing for transactions exceeding the per-transaction limit.

#### Scenario: Transaction within per-tx limit
- **WHEN** a `sign_transaction` request has an estimated USD value ≤ `maxPerTxUsd`
- **THEN** the Signer SHALL allow it to proceed to daily limit check

#### Scenario: Transaction exceeds per-tx limit
- **WHEN** a `sign_transaction` request has an estimated USD value > `maxPerTxUsd`
- **THEN** the Signer SHALL escalate to Level 1 or Level 2 confirmation

### Requirement: Daily cumulative limit check
The Signer SHALL track daily cumulative spending in integer cents to prevent float precision attacks.

#### Scenario: Daily total within limit
- **WHEN** the running 24-hour total (in cents) plus the new transaction amount (in cents) is ≤ `maxDailyUsd * 100`
- **THEN** the Signer SHALL allow auto-signing and record the spending

#### Scenario: Daily total exceeds limit
- **WHEN** the running 24-hour total plus the new transaction would exceed `maxDailyUsd * 100` cents
- **THEN** the Signer SHALL escalate to Level 1 or Level 2 confirmation

#### Scenario: Daily spending window rolls
- **WHEN** spending records older than 24 hours exist
- **THEN** the Signer SHALL exclude them from the running total

### Requirement: Allowed tokens check
The Signer SHALL only auto-sign for tokens in the allowed list.

#### Scenario: Known token auto-approved
- **WHEN** the transaction token is in the `allowedTokens` list
- **THEN** the Signer SHALL allow it to proceed to amount checks

#### Scenario: Unknown token escalated
- **WHEN** the transaction token is not in the `allowedTokens` list
- **THEN** the Signer SHALL escalate to Level 1 or Level 2 confirmation

### Requirement: Allowed recipients check
The Signer SHALL use the address whitelist to determine auto-sign eligibility.

#### Scenario: Whitelisted recipient auto-approved
- **WHEN** the recipient address is in the whitelist (case-insensitive comparison)
- **THEN** the Signer SHALL allow it to proceed to amount checks

#### Scenario: Unknown recipient with allowance enabled
- **WHEN** the recipient is not whitelisted and the allowance `allowedRecipients` list is non-empty
- **THEN** the Signer SHALL escalate to Level 1 or Level 2 confirmation

#### Scenario: Empty allowedRecipients list
- **WHEN** `allowedRecipients` is empty
- **THEN** the Signer SHALL fall back to the policy engine's whitelist for recipient validation

### Requirement: Allowance persistence
The AllowancePolicy and daily spending records SHALL be persisted to disk.

#### Scenario: Signer restart preserves allowance
- **WHEN** the Signer is restarted
- **THEN** the Signer SHALL reload the AllowancePolicy and daily spending records from disk

#### Scenario: Spending records use secure write
- **WHEN** allowance data is written to disk
- **THEN** the Signer SHALL use atomic write with 0600 permissions

### Requirement: Allowance modification requires Level 2
Modifying the AllowancePolicy SHALL always require the highest level of user authorization.

#### Scenario: Agent requests allowance increase
- **WHEN** a `set_allowance` request increases `maxDailyUsd` or `maxPerTxUsd`
- **THEN** the Signer SHALL require Level 2 full approval with the new values displayed to the user

#### Scenario: Agent requests allowance decrease
- **WHEN** a `set_allowance` request decreases limits
- **THEN** the Signer SHALL still require Level 2 full approval (no exception for "safer" changes)
