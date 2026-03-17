## ADDED Requirements

### Requirement: Add contact
The system SHALL allow adding a named contact with one or more blockchain addresses.

#### Scenario: Add contact with single-chain address
- **WHEN** user invokes `wallet_contacts_add` with name "trading-bot" and address "0xABC..." for chain "base"
- **THEN** the system stores the contact in `contacts.json` with the name, address, chain, and timestamp

#### Scenario: Add contact with multi-chain addresses
- **WHEN** user invokes `wallet_contacts_add` with name "trading-bot" and addresses for multiple chains
- **THEN** the system stores all chain-address pairs under the same contact name

#### Scenario: Duplicate contact name
- **WHEN** user invokes `wallet_contacts_add` with a name that already exists
- **THEN** the system SHALL update the existing contact's addresses (merge, not replace)

### Requirement: List contacts
The system SHALL list all stored contacts with their addresses.

#### Scenario: List all contacts
- **WHEN** user invokes `wallet_contacts_list`
- **THEN** the system returns all contacts with their names, addresses, supported chains, and last-updated timestamps

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
- **THEN** the system removes the contact from `contacts.json` and confirms removal

#### Scenario: Remove non-existent contact
- **WHEN** user invokes `wallet_contacts_remove` with a name that doesn't exist
- **THEN** the system returns an error indicating the contact was not found
