## MODIFIED Requirements

### Requirement: AuthProvider interface
The Signer SHALL interact with users through a pluggable AuthProvider interface, supporting multiple deployment scenarios. Production usage SHALL require an explicit AuthProvider selection.

#### Scenario: TUI provider in CLI mode
- **WHEN** the Signer is configured with `TuiAuthProvider`
- **THEN** the Signer SHALL read user input from `/dev/tty` (or platform equivalent), completely separate from the Agent process's stdin/stdout

#### Scenario: GUI provider in desktop mode
- **WHEN** the Signer is configured with `GuiAuthProvider`
- **THEN** the Signer SHALL display a native OS dialog for password entry and transaction confirmation

#### Scenario: Webhook provider in server mode
- **WHEN** the Signer is configured with `WebhookAuthProvider`
- **THEN** the Signer SHALL send a notification (HTTP POST) to a configured endpoint and poll/wait for the user's response

#### Scenario: AuthProvider timeout
- **WHEN** the user does not respond within a configurable timeout (default 60 seconds)
- **THEN** the Signer SHALL reject the signing request and return a timeout error to the Tool

#### Scenario: CLI requires explicit --auth-type
- **WHEN** `claw-signer` is started without the `--auth-type` argument
- **THEN** the process SHALL exit with error: "Error: --auth-type is required. Use: tui, gui, or webhook"

#### Scenario: Suspiciously fast AuthProvider response
- **WHEN** an AuthProvider's `requestPin` call returns in less than 10ms
- **THEN** the Signer SHALL write a security warning to the audit log: "AuthProvider responded suspiciously fast — possible test provider in production"

### Requirement: Three-level authorization model
The Signer SHALL enforce a three-level authorization model for all signing operations. Level 2 operations SHALL always require full password entry regardless of session state.

#### Scenario: Level 0 — auto-sign within allowance
- **WHEN** a `sign_transaction` request matches the current AllowancePolicy (amount within per-tx limit, daily total within daily limit, token in allowed list, recipient in allowed list)
- **THEN** the Signer SHALL sign the transaction automatically without any user interaction

#### Scenario: Level 1 — quick confirmation
- **WHEN** a `sign_transaction` request exceeds the allowance but is within a reasonable range (configurable, default $100-$1000)
- **THEN** the Signer SHALL prompt the user for a quick confirmation via the AuthProvider, displaying the transaction summary (to, amount, token, chain)

#### Scenario: Level 2 — full approval with mandatory password
- **WHEN** a `sign_transaction` request is for a large amount (above Level 1 threshold) or targets an unknown recipient
- **THEN** the Signer SHALL prompt the user for full approval via the AuthProvider, displaying complete transaction details, and require password entry even if a session is active

#### Scenario: Level 2 required for allowance modification
- **WHEN** `set_allowance` is called to modify the pre-authorization policy
- **THEN** the Signer SHALL always require Level 2 full approval with password entry, regardless of session state
