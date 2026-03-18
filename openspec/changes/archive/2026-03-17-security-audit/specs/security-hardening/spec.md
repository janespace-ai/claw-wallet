## ADDED Requirements

### Requirement: Address validation utility
The system SHALL provide a shared address validation function.

#### Scenario: validateAddress with valid input
- **WHEN** `validateAddress("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed")` is called
- **THEN** it SHALL return the checksummed address

#### Scenario: validateAddress with invalid input
- **WHEN** `validateAddress("not-an-address")` is called
- **THEN** it SHALL throw a validation error

### Requirement: Amount validation utility
The system SHALL provide a shared amount validation function.

#### Scenario: validateAmount with valid input
- **WHEN** `validateAmount("100.5")` is called
- **THEN** it SHALL return the string as-is (valid)

#### Scenario: validateAmount with invalid input
- **WHEN** `validateAmount("-1")` or `validateAmount("NaN")` is called
- **THEN** it SHALL throw a validation error

### Requirement: Keystore schema validation utility
The system SHALL validate keystore JSON against V3 schema before use.

#### Scenario: Valid keystore passes
- **WHEN** a properly structured Keystore V3 JSON is validated
- **THEN** it SHALL pass without error

#### Scenario: Missing fields rejected
- **WHEN** a keystore JSON missing `crypto.ciphertext` is validated
- **THEN** it SHALL throw a schema error listing the missing field

#### Scenario: KDF params out of bounds
- **WHEN** `kdfparams.n` exceeds 2^20 (1048576)
- **THEN** validation SHALL reject it as potentially dangerous

### Requirement: Secure file write utility
The system SHALL provide a utility for writing files with restricted permissions.

#### Scenario: Write with 0600 permissions
- **WHEN** `secureWriteFile(path, data)` is called
- **THEN** the file SHALL be created with 0600 permissions

#### Scenario: Atomic write on supported platforms
- **WHEN** `secureWriteFile(path, data)` is called
- **THEN** data SHALL be written to a temp file first, then renamed to the target path

## MODIFIED Requirements

### Requirement: Secure key signing
The system SHALL decrypt the private key only during transaction signing and immediately clear it from memory afterward.

#### Scenario: Sign and clear
- **WHEN** the system needs to sign a transaction
- **THEN** it decrypts the private key from keystore using the master password, signs the transaction, overwrites the key buffer with zeros, and returns only the signed transaction hash

#### Scenario: Sign uses Buffer internally
- **WHEN** the private key is decrypted for signing
- **THEN** the internal flow SHALL prefer Buffer over Hex string to maximize clearable memory
