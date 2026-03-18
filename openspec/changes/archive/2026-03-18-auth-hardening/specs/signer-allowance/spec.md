## MODIFIED Requirements

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
