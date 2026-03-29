## MODIFIED Requirements

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

## ADDED Requirements

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
