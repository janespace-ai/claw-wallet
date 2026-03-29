## ADDED Requirements

### Requirement: Contact identity uniqueness on Desktop

The authoritative Desktop contact store SHALL enforce that **each display name** (case-insensitive) appears on **at most one row**, and each **(normalized address, normalized chain)** pair appears on **at most one row**.

#### Scenario: Duplicate name rejected on add

- **WHEN** an insert would create a second row with the same name as an existing row but different `(address, chain)` without an intentional update path
- **THEN** the implementation SHALL define whether this is an update-in-place of the single row or a rejected operation with a clear error; in all cases the invariant MUST hold that only one row exists per name

#### Scenario: Duplicate address and chain rejected

- **WHEN** a user or Agent attempts to add a contact whose `(address, chain)` already belongs to another name
- **THEN** the system SHALL reject the operation with a machine-readable error and SHALL NOT create a conflicting row

## MODIFIED Requirements

### Requirement: Add contact

The system SHALL allow adding a named contact bound to **exactly one** `(address, chain)` on the Desktop authoritative store. When the add is initiated by the Agent through the paired Desktop, **the Desktop SHALL prompt the user to classify the add as normal or trusted or reject** before any authoritative row is written; the Agent SHALL treat rejection or timeout as failure. The same **display name** SHALL NOT be associated with multiple distinct `(address, chain)` rows simultaneously. Adding again with the same name SHALL **replace** the existing row’s address, chain, and trusted flag as confirmed in the modal.

#### Scenario: Add contact with single-chain address

- **WHEN** user invokes `wallet_contacts_add` with name "trading-bot" and address "0xABC..." for chain "base" **and the Desktop user selects normal contact in the modal**
- **THEN** the system stores exactly one authoritative row for that name with that `address`, `chain`, and `trusted` false (and mirrors to Agent local cache after success)

#### Scenario: Same name second add updates the single row

- **WHEN** user invokes `wallet_contacts_add` with the same name as an existing contact but a new address and/or chain and the Desktop user confirms
- **THEN** the system SHALL replace the prior `(address, chain, trusted)` for that name with the newly confirmed values so that the uniqueness invariants remain satisfied

#### Scenario: Agent add rejected on Desktop

- **WHEN** the Desktop user rejects the contact-add modal
- **THEN** the Agent tool SHALL fail with a clear error and no change to authoritative storage

### Requirement: List contacts

The system SHALL list all stored contacts with their **single** `(address, chain)` **and trusted flag** for each name.

#### Scenario: List all contacts

- **WHEN** user invokes `wallet_contacts_list`
- **THEN** the system returns every contact row with its name, address, chain, **trusted** flag, and last-updated metadata as available

#### Scenario: No contacts stored

- **WHEN** user invokes `wallet_contacts_list` but no contacts exist
- **THEN** the system returns an empty list with a message indicating no contacts are stored

### Requirement: Resolve contact name to address

The system SHALL resolve a contact **name** to the **single** blockchain address and chain stored for that name.

#### Scenario: Resolve known contact

- **WHEN** user invokes `wallet_contacts_resolve` with name "trading-bot" and chain "base" and the stored row is for chain "base"
- **THEN** the system returns that Base address with `exactMatch` true

#### Scenario: Wrong chain for name

- **WHEN** user invokes `wallet_contacts_resolve` with a chain that does not match the stored chain for that name
- **THEN** the system SHALL return an error or structured response indicating the contact exists on a different chain (not silent fallback to another chain)

#### Scenario: Unknown contact

- **WHEN** user invokes `wallet_contacts_resolve` with a name that doesn't exist
- **THEN** the system returns an error indicating the contact is not found

### Requirement: Remove contact

The system SHALL allow removing a contact **by name**, deleting **the single** authoritative row for that name.

#### Scenario: Remove existing contact

- **WHEN** user invokes `wallet_contacts_remove` with name "trading-bot"
- **THEN** the system removes the row for that name from authoritative storage and confirms removal in Agent cache when paired

#### Scenario: Remove non-existent contact

- **WHEN** user invokes `wallet_contacts_remove` with a name that doesn't exist
- **THEN** the system returns an error indicating the contact was not found

### Requirement: Contact name sanitization

Contact names SHALL be validated for safe characters and length.

#### Scenario: Contact name with path traversal

- **WHEN** a contact name like "../../etc/passwd" is provided
- **THEN** the system SHALL sanitize or reject it

#### Scenario: Empty contact name rejected

- **WHEN** an empty string is provided as contact name
- **THEN** the system SHALL reject it

#### Scenario: Excessively long name rejected

- **WHEN** a contact name longer than 100 characters is provided
- **THEN** the system SHALL reject it
