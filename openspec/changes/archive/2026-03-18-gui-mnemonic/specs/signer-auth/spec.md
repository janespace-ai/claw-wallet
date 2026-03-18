## MODIFIED Requirements

### Requirement: AuthProvider interface
The Signer SHALL interact with users through a pluggable AuthProvider interface, supporting multiple deployment scenarios. Production usage SHALL require an explicit AuthProvider selection. The interface SHALL include a method for securely displaying sensitive data to the user without returning it through IPC.

#### Scenario: TUI provider in CLI mode
- **WHEN** the Signer is configured with `TuiAuthProvider`
- **THEN** the Signer SHALL read user input from `/dev/tty` (or platform equivalent), completely separate from the Agent process's stdin/stdout

#### Scenario: GUI provider in desktop mode
- **WHEN** the Signer is configured with `GuiAuthProvider`
- **THEN** the Signer SHALL launch a localhost HTTP server and open the system browser to display password entry dialogs and transaction confirmation pages

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

#### Scenario: Display secret to user
- **WHEN** `displaySecretToUser` is called with a title and secret string
- **THEN** the AuthProvider SHALL display the secret directly to the user (GUI: browser page; TUI: /dev/tty output) without transmitting it through IPC or making it accessible to the Agent process
