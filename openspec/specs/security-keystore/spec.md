## ADDED Requirements

### Requirement: Private key entropy quality
Generated private keys SHALL have sufficient cryptographic entropy.

#### Scenario: Keys are 32 bytes from crypto.randomBytes
- **WHEN** `generateWallet()` is called 100 times
- **THEN** all keys SHALL be unique and each SHALL be exactly 32 bytes (64 hex chars)

#### Scenario: No predictable patterns
- **WHEN** 100 private keys are generated
- **THEN** no two consecutive keys SHALL share more than 4 leading hex characters

### Requirement: Encryption correctness
AES-256-GCM encryption SHALL produce ciphertext indistinguishable from random and SHALL include authentication.

#### Scenario: Ciphertext differs from plaintext
- **WHEN** a private key is encrypted
- **THEN** the ciphertext SHALL NOT contain any substring of the plaintext private key

#### Scenario: Different ciphertexts for same key
- **WHEN** the same private key is encrypted twice with the same password
- **THEN** the two ciphertexts SHALL differ (due to random salt and IV)

#### Scenario: Auth tag prevents tampering
- **WHEN** a single byte of the ciphertext is modified
- **THEN** decryption SHALL fail with an authentication error

### Requirement: Memory clearing after signing
The system SHALL clear private key material from memory after use.

#### Scenario: Buffer is zeroed after sign
- **WHEN** `signTransaction()` completes
- **THEN** the Buffer created from the private key SHALL be filled with zeros

#### Scenario: Buffer is zeroed even on signing error
- **WHEN** `signTransaction()` fails due to invalid transaction
- **THEN** the private key Buffer SHALL still be cleared (finally block)

### Requirement: KDF parameter validation
The system SHALL reject keystore files with dangerous KDF parameters.

#### Scenario: Extremely high scrypt N value (DoS)
- **WHEN** a keystore is loaded with `kdfparams.n` set to 2^30
- **THEN** `decryptKey()` SHALL reject it with a validation error before attempting derivation

#### Scenario: Zero or negative KDF parameters
- **WHEN** a keystore has `kdfparams.dklen` set to 0 or `kdfparams.r` set to -1
- **THEN** the system SHALL reject it with a validation error

#### Scenario: Missing KDF fields
- **WHEN** a keystore is missing `kdfparams.salt`
- **THEN** the system SHALL reject it with a schema validation error

### Requirement: Password brute-force resistance
The scrypt KDF parameters SHALL provide adequate brute-force resistance.

#### Scenario: KDF computation time
- **WHEN** `decryptKey()` is called with the correct password
- **THEN** the operation SHALL take at least 100ms (indicating sufficient work factor)

### Requirement: Keystore schema validation
The system SHALL validate keystore JSON structure before use.

#### Scenario: Invalid JSON structure
- **WHEN** `loadKeystore()` reads a file with missing `crypto` field
- **THEN** the system SHALL throw a schema validation error

#### Scenario: Wrong version
- **WHEN** a keystore has `version: 2` instead of `version: 3`
- **THEN** the system SHALL reject it
