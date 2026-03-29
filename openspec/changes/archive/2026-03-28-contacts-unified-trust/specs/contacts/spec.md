## MODIFIED Requirements

### Requirement: Add contact

The system SHALL allow adding a named contact with one or more blockchain addresses. When the add is initiated by the Agent through the paired Desktop, **the Desktop SHALL prompt the user to classify the add as normal or trusted or reject** before any authoritative row is written; the Agent SHALL treat rejection or timeout as failure.

#### Scenario: Add contact with single-chain address

- **WHEN** user invokes `wallet_contacts_add` with name "trading-bot" and address "0xABC..." for chain "base" **and the Desktop user selects normal contact in the modal**
- **THEN** the system stores the contact in authoritative storage with `trusted` false (and still mirrors to Agent local cache after success)

#### Scenario: Add contact with multi-chain addresses

- **WHEN** user invokes `wallet_contacts_add` with name "trading-bot" and addresses for multiple chains
- **THEN** the system SHALL apply the same user confirmation **per logical add operation** as defined by the tool (each Desktop round-trip) and merge addresses under the same name when confirmed

#### Scenario: Duplicate contact name

- **WHEN** user invokes `wallet_contacts_add` with a name that already exists
- **THEN** the system SHALL update the existing contact's addresses on confirmation (merge, not replace) and preserve or update `trusted` according to the user's modal choice

#### Scenario: Agent add rejected on Desktop

- **WHEN** the Desktop user rejects the contact-add modal
- **THEN** the Agent tool SHALL fail with a clear error and no change to authoritative storage

### Requirement: List contacts

The system SHALL list all stored contacts with their addresses **and trusted flag** where applicable.

#### Scenario: List all contacts

- **WHEN** user invokes `wallet_contacts_list`
- **THEN** the system returns all contacts with their names, addresses, chains, **trusted** flag, and last-updated metadata as available

#### Scenario: No contacts stored

- **WHEN** user invokes `wallet_contacts_list` but no contacts exist
- **THEN** the system returns an empty list with a message indicating no contacts are stored

### Requirement: Resolve contact name to address

The system SHALL resolve a contact name to a blockchain address for a specified chain.

#### Scenario: Resolve known contact

- **WHEN** user invokes `wallet_contacts_resolve` with name "trading-bot" and chain "base"
- **THEN** the system returns the Base address for "trading-bot"

#### Scenario: Contact exists but not on requested chain

- **WHEN** user invokes `wallet_contacts_resolve` with name "trading-bot" and chain "ethereum", but the contact only has a Base address
- **THEN** the system returns the available address with a note that it's registered on a different chain

#### Scenario: Unknown contact

- **WHEN** user invokes `wallet_contacts_resolve` with a name that doesn't exist
- **THEN** the system returns an error indicating the contact is not found

### Requirement: Remove contact

The system SHALL allow removing a contact by name.

#### Scenario: Remove existing contact

- **WHEN** user invokes `wallet_contacts_remove` with name "trading-bot"
- **THEN** the system removes all chain rows for that name from authoritative storage and confirms removal in Agent cache when paired

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
