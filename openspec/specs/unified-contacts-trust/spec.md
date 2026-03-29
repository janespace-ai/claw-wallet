## ADDED Requirements

### Requirement: Single SQLite model for contacts with trusted flag

The Desktop wallet SHALL store authoritative contacts in one table that includes a per-row **`trusted`** flag (trusted contact eligible for silent signing within allowance). The separate `trusted_addresses` table SHALL be removed after migration.

#### Scenario: Trusted row participates in address gate

- **WHEN** the signing policy requires a trusted recipient for silent sign AND the transaction counterparty address matches a row in the contacts table for the same logical chain with `trusted` true
- **THEN** the address gate for silent signing SHALL pass (subject to USD and token limits)

#### Scenario: Untrusted row does not grant silent sign by address

- **WHEN** the counterparty matches a contact with `trusted` false only
- **THEN** the address gate SHALL treat the recipient as not trusted for silent signing

### Requirement: Desktop modal for Agent-initiated contact add

- **WHEN** the Agent invokes contact add over Relay with name, address, and chain
- **THEN** the Desktop SHALL show a modal with exactly three actions: add as normal contact, add as trusted contact, or reject; SHALL NOT persist the row until the user selects one of the first two; SHALL return an error to the Agent if the user rejects or the request times out

#### Scenario: User adds as trusted

- **WHEN** the user chooses add as trusted contact
- **THEN** the Desktop SHALL upsert the contact with `trusted` true and return success to the Agent

#### Scenario: User rejects

- **WHEN** the user chooses reject
- **THEN** the Desktop SHALL return an error with a machine-readable code indicating user rejection and SHALL NOT insert or update the contact

### Requirement: Stranger recipient on outgoing sign request

- **WHEN** the user approves a `sign_transaction` whose counterparty (per `recipient` or `to` rules) is not yet a trusted contact for that chain
- **THEN** the Desktop MAY offer an optional checkbox to save the counterparty as a trusted contact after successful on-chain execution, requiring a non-empty display name when checked

#### Scenario: Successful tx creates trusted contact and notifies Agent

- **WHEN** the user checked the option, entered a valid name, the transaction succeeds on-chain, and the Desktop notifies the Agent with transaction result
- **THEN** the payload SHALL include sufficient fields for the Agent to upsert local cache (`name`, normalized `address`, `chain`, `trusted` true)

### Requirement: Contacts list shows trusted badge

- **WHEN** the user opens the unified Contacts screen
- **THEN** each row with `trusted` true SHALL display a visible trusted indicator and explanatory text SHALL state that trusted contacts may receive auto-approved transfers within configured limits
