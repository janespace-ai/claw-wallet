## ADDED Requirements

### Requirement: Three-level authorization model
The Signer SHALL enforce a three-level authorization model for all signing operations.

#### Scenario: Level 0 — auto-sign within allowance
- **WHEN** a `sign_transaction` request matches the current AllowancePolicy (amount within per-tx limit, daily total within daily limit, token in allowed list, recipient in allowed list)
- **THEN** the Signer SHALL sign the transaction automatically without any user interaction

#### Scenario: Level 1 — quick confirmation
- **WHEN** a `sign_transaction` request exceeds the allowance but is within a reasonable range (configurable, default $100-$1000)
- **THEN** the Signer SHALL prompt the user for a quick PIN/biometric confirmation via the AuthProvider, displaying the transaction summary (to, amount, token, chain)

#### Scenario: Level 2 — full approval
- **WHEN** a `sign_transaction` request is for a large amount (above Level 1 threshold) or targets an unknown recipient
- **THEN** the Signer SHALL prompt the user for full approval via the AuthProvider, displaying complete transaction details, and require PIN entry

#### Scenario: Level 2 required for allowance modification
- **WHEN** `set_allowance` is called to modify the pre-authorization policy
- **THEN** the Signer SHALL always require Level 2 full approval, regardless of the change magnitude

### Requirement: AuthProvider interface
The Signer SHALL interact with users through a pluggable AuthProvider interface, supporting multiple deployment scenarios.

#### Scenario: TUI provider in CLI mode
- **WHEN** the Signer is configured with `TuiAuthProvider`
- **THEN** the Signer SHALL read user input from `/dev/tty` (or platform equivalent), completely separate from the Agent process's stdin/stdout

#### Scenario: GUI provider in desktop mode
- **WHEN** the Signer is configured with `GuiAuthProvider`
- **THEN** the Signer SHALL display a native OS dialog for PIN entry and transaction confirmation

#### Scenario: Webhook provider in server mode
- **WHEN** the Signer is configured with `WebhookAuthProvider`
- **THEN** the Signer SHALL send a notification (HTTP POST) to a configured endpoint and poll/wait for the user's response

#### Scenario: AuthProvider timeout
- **WHEN** the user does not respond within a configurable timeout (default 60 seconds)
- **THEN** the Signer SHALL reject the signing request and return a timeout error to the Tool

### Requirement: Transaction context display
The AuthProvider SHALL display the full transaction context when requesting user confirmation.

#### Scenario: ETH transfer confirmation
- **WHEN** Level 1 or Level 2 confirmation is required for an ETH transfer
- **THEN** the AuthProvider SHALL display: recipient address, amount, chain name, estimated gas cost

#### Scenario: ERC-20 transfer confirmation
- **WHEN** Level 1 or Level 2 confirmation is required for a token transfer
- **THEN** the AuthProvider SHALL display: recipient address, token symbol, amount, chain name, contract address

### Requirement: Signing audit log
The Signer SHALL maintain an audit log of all signing operations.

#### Scenario: Auto-signed transaction logged
- **WHEN** a transaction is auto-signed under Level 0 allowance
- **THEN** the Signer SHALL log: timestamp, recipient, amount, token, chain, "auto-approved"

#### Scenario: User-confirmed transaction logged
- **WHEN** a transaction is signed after Level 1 or Level 2 confirmation
- **THEN** the Signer SHALL log: timestamp, recipient, amount, token, chain, authorization level, "user-confirmed"

#### Scenario: Rejected transaction logged
- **WHEN** a user rejects a signing request or it times out
- **THEN** the Signer SHALL log: timestamp, recipient, amount, token, chain, "rejected" or "timeout"
