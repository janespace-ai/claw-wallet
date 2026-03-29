## MODIFIED Requirements

### Requirement: Unified Contacts screen

The Electron App SHALL provide a single Contacts view listing all authoritative contacts with a **trusted** visual indicator and short help text that trusted contacts may be auto-approved within limits. The help text SHALL state that **each contact name holds one address on one chain**; multi-chain recipients SHALL use separate names or separate contact entries.

#### Scenario: User sees trusted badge

- **WHEN** at least one contact row has `trusted` true
- **THEN** the Contacts list SHALL display a distinct trusted badge on those rows

### Requirement: Transaction approval optional new trusted contact

- **WHEN** the approval dialog is shown for a `sign_transaction` whose counterparty is eligible for the "save as trusted" flow per product rules
- **THEN** the App SHALL offer optional UI to enter a display name and opt in to creating or upgrading a trusted contact after successful on-chain result

#### Scenario: Name required when opt-in

- **WHEN** the user opts in to save as trusted but leaves the name empty
- **THEN** the App SHALL block approval until a valid name is provided or the user clears the opt-in

#### Scenario: Approval shows resolved contact when in address book

- **WHEN** the signing counterparty matches a contact row for the same chain **before** user approves or rejects
- **THEN** the dialog SHALL prominently show the **contact display name** and whether the row is **trusted**, and SHALL still show the **full or truncated address** for verification

#### Scenario: Approval without address book match

- **WHEN** the counterparty does not match any contact for that chain
- **THEN** the dialog SHALL show the recipient as a non-contact (e.g. raw address) without inventing a name

## ADDED Requirements

### Requirement: Signing and Activity lists show resolved contact labels

The Electron App SHALL, when rendering **Signing history** and **Activity** lists, **resolve** each record’s recipient `address` and `chain` against the **current** authoritative contacts for display. **No additional persistent snapshot columns are required** for contact name at sign time.

#### Scenario: Activity row labels known recipient

- **WHEN** an activity row has `tx_to` and `tx_chain` that match exactly one contact row
- **THEN** the UI SHALL show the **contact name** and **trusted** indicator before or beside the address

#### Scenario: Signing history row labels known recipient

- **WHEN** a signing history row has recipient and chain matching exactly one contact row
- **THEN** the UI SHALL show the **contact name** and **trusted** indicator before or beside the address

#### Scenario: No match uses address only

- **WHEN** no contact matches the `(address, chain)` for a row
- **THEN** the UI SHALL show only the address (and existing type/status) without a contact name
