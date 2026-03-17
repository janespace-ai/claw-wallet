## ADDED Requirements

### Requirement: Address format validation
All address inputs SHALL be validated for correct format and checksum.

#### Scenario: Valid checksummed address accepted
- **WHEN** a valid EIP-55 checksummed address is provided
- **THEN** the system SHALL accept it

#### Scenario: Invalid hex characters rejected
- **WHEN** an address containing non-hex characters (e.g., "0xGGGG...") is provided
- **THEN** the system SHALL reject it with a clear error message

#### Scenario: Wrong length rejected
- **WHEN** an address with fewer or more than 40 hex chars is provided
- **THEN** the system SHALL reject it

#### Scenario: Invalid checksum rejected
- **WHEN** an address with incorrect EIP-55 checksum is provided (mixed case but wrong)
- **THEN** the system SHALL reject it with a checksum error

#### Scenario: All-lowercase accepted (no checksum)
- **WHEN** an all-lowercase address (e.g., "0xabcd...") is provided
- **THEN** the system SHALL accept it (no checksum to verify)

### Requirement: Amount boundary validation
All amount inputs SHALL be validated for safe numeric ranges.

#### Scenario: Zero amount rejected
- **WHEN** amount "0" is provided for a transfer
- **THEN** the system SHALL reject it

#### Scenario: Negative amount rejected
- **WHEN** amount "-1" is provided
- **THEN** the system SHALL reject it

#### Scenario: NaN rejected
- **WHEN** amount "abc" or "NaN" is provided
- **THEN** the system SHALL reject it with "Invalid amount"

#### Scenario: Infinity rejected
- **WHEN** amount "Infinity" or "1e999" is provided
- **THEN** the system SHALL reject it

#### Scenario: Extremely large amount handled
- **WHEN** amount "999999999999999999999999" is provided
- **THEN** the system SHALL handle it without overflow (BigInt-safe parsing)

### Requirement: Token input sanitization
Token symbol inputs SHALL be sanitized to prevent injection.

#### Scenario: Token with special characters
- **WHEN** token input contains "../" or script tags
- **THEN** the system SHALL reject it or sanitize safely

#### Scenario: Excessively long token symbol
- **WHEN** a token symbol longer than 20 characters is provided
- **THEN** the system SHALL reject it

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
