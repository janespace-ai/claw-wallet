## ADDED Requirements

### Requirement: Electron App key management
The Electron App SHALL manage private keys locally using BIP-39 mnemonic generation and AES-256-GCM encrypted storage. Private keys SHALL never leave the Electron App process.

#### Scenario: Create new wallet
- **WHEN** user clicks Create Wallet in the Electron App
- **THEN** the App SHALL generate a 12-word BIP-39 mnemonic, derive the private key via BIP-44 path, prompt the user for a strong password, encrypt the private key and mnemonic with the password-derived key, and display the mnemonic for user backup

#### Scenario: Import wallet via mnemonic
- **WHEN** user enters a mnemonic phrase in the import dialog
- **THEN** the App SHALL validate the mnemonic, derive the private key via BIP-44, prompt for a new password, encrypt and store locally

#### Scenario: Import wallet via private key
- **WHEN** user enters a raw private key in the import dialog
- **THEN** the App SHALL validate the key format, prompt for a new password, encrypt and store locally

### Requirement: Signing engine with allowance
The Electron App SHALL include an embedded signing engine that automatically signs transactions within the configured allowance budget and prompts user confirmation for transactions exceeding the budget. **Recipient address restrictions for silent signing SHALL derive from unified contacts with `trusted` true**, not from a separate trusted-address table.

#### Scenario: Auto-sign within budget
- **WHEN** a signing request arrives and the transaction amount is within the per-transaction limit AND the daily cumulative total is within the daily limit **AND** address policy (when active) indicates the counterparty is a trusted contact
- **THEN** the App SHALL decrypt the private key, sign the transaction, clear the key from memory, and return the signed transaction through the E2EE channel without user interaction

#### Scenario: Prompt for over-budget transaction
- **WHEN** a signing request arrives and the transaction exceeds the allowance budget
- **THEN** the App SHALL display a confirmation dialog showing transaction details and wait for user approval or rejection

#### Scenario: User rejects transaction
- **WHEN** user clicks Reject on the confirmation dialog
- **THEN** the App SHALL return a rejection response through the E2EE channel and log the rejection

#### Scenario: Allowance budget configuration
- **WHEN** user opens the Allowance settings
- **THEN** the App SHALL allow configuring daily total limit, per-transaction limit, and allowed tokens list; **separate "allowed recipient address list" SHALL NOT be required** when unified contacts with `trusted` fulfill that role

### Requirement: System tray persistence
The Electron App SHALL support running as a system tray application for continuous background operation.

#### Scenario: Minimize to tray
- **WHEN** user closes the main window
- **THEN** the App SHALL minimize to the system tray and continue running in the background maintaining the WebSocket connection

#### Scenario: Tray icon status
- **WHEN** the App is connected to the Relay and paired with an Agent
- **THEN** the tray icon SHALL show a connected indicator and when disconnected it SHALL show a disconnected indicator

#### Scenario: Tray notification for confirmation
- **WHEN** a transaction requires user confirmation while the App is minimized
- **THEN** the App SHALL show a system notification and restore the window to display the confirmation dialog

### Requirement: Lock screen with convenience mode
The Electron App SHALL support a lock screen mechanism with convenience mode as the default where the signing key remains in memory during idle.

#### Scenario: Convenience mode idle behavior
- **WHEN** the App is idle and in convenience mode (default)
- **THEN** the private key SHALL remain in memory and auto-signing within budget SHALL continue and over-budget transactions SHALL still require user confirmation via dialog

#### Scenario: Strict mode idle behavior
- **WHEN** the App is idle and the user has enabled strict mode
- **THEN** the App SHALL clear the private key from memory after the configured idle timeout (default 5 minutes) and reject all signing requests until the user re-authenticates

#### Scenario: Manual lock
- **WHEN** user clicks Lock or uses the lock keyboard shortcut
- **THEN** the App SHALL immediately clear the private key from memory and require re-authentication regardless of the current mode

#### Scenario: System lock triggers app lock
- **WHEN** the operating system screen is locked or the system enters sleep mode
- **THEN** the App SHALL clear the private key from memory and require re-authentication when the system unlocks

### Requirement: Same-machine detection and warning
The Electron App SHALL detect when it is running on the same machine as the paired Agent and SHALL display a mandatory security warning.

#### Scenario: Same-machine pairing detected
- **WHEN** the Agent machineId exchanged during pairing matches the Electron App machineId
- **THEN** the App SHALL display a prominent non-dismissable security warning explaining that running on the same machine significantly reduces security

#### Scenario: User acknowledges same-machine risk
- **WHEN** the same-machine warning is displayed
- **THEN** the user SHALL be required to type a confirmation phrase to proceed and the App SHALL display a persistent risk badge in the UI

#### Scenario: Same-machine warning on every launch
- **WHEN** the App launches and a same-machine pairing exists
- **THEN** the warning SHALL be shown again on each launch not just the first time

### Requirement: Unified Contacts screen
The Electron App SHALL provide a single Contacts view listing all authoritative contacts with a **trusted** visual indicator and short help text that trusted contacts may be auto-approved within limits.

#### Scenario: User sees trusted badge
- **WHEN** at least one contact row has `trusted` true
- **THEN** the Contacts list SHALL display a distinct trusted badge on those rows

### Requirement: Transaction approval optional new trusted contact
- **WHEN** the approval dialog is shown for a `sign_transaction` whose counterparty is eligible for the "save as trusted" flow per product rules
- **THEN** the App SHALL offer optional UI to enter a display name and opt in to creating or upgrading a trusted contact after successful on-chain result

#### Scenario: Name required when opt-in
- **WHEN** the user opts in to save as trusted but leaves the name empty
- **THEN** the App SHALL block approval until a valid name is provided or the user clears the opt-in
