## ADDED Requirements

### Requirement: Trusted addresses are wallet-authoritative

Trusted addresses (signing whitelist) SHALL be stored only in the desktop wallet persistent store (SQLite as specified in the change design). The Agent SHALL NOT persist a separate whitelist that affects desktop signing decisions.

#### Scenario: Agent cannot silently extend trust

- **WHEN** an Agent attempts to add a trusted address without desktop user confirmation
- **THEN** that address SHALL NOT be treated as trusted for silent signing until confirmed through desktop policy UI or an approved desktop flow

### Requirement: Trust-after-success for approval checkbox

When the user opts to trust a recipient address during transaction approval, the desktop SHALL persist that address to the trusted list only after a successful transaction receipt for that signed transfer (per change design option B).

#### Scenario: Failed broadcast does not add trust

- **WHEN** the user checked “trust this address” but the broadcast fails or the receipt indicates failure
- **THEN** the address SHALL NOT be added to the trusted list
