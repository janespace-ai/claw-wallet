## ADDED Requirements

### Requirement: Keystore file permissions
The keystore file SHALL be written with restrictive permissions.

#### Scenario: File created with 0600 permissions
- **WHEN** `saveKeystore()` writes the keystore file
- **THEN** the file SHALL have permissions 0600 (owner read/write only)

#### Scenario: Existing file permissions preserved on update
- **WHEN** a keystore file is overwritten
- **THEN** the restrictive permissions SHALL be maintained

### Requirement: Path traversal prevention
The system SHALL prevent directory traversal via user-supplied paths.

#### Scenario: Data directory with traversal
- **WHEN** `dataDir` is set to "/tmp/../../../etc"
- **THEN** the system SHALL normalize the path and prevent writing outside the intended directory

#### Scenario: Contact name path injection
- **WHEN** contact data is saved with a name containing path separators
- **THEN** the name SHALL be stored as-is in JSON (not used as a path component) without file system impact

### Requirement: Atomic file writes
Sensitive data files SHALL be written atomically to prevent corruption.

#### Scenario: Crash during keystore write
- **WHEN** the process crashes during keystore file writing
- **THEN** the previous valid keystore SHALL remain intact (write-then-rename pattern)

### Requirement: No sensitive data in logs or errors
Error messages SHALL NOT contain private keys, passwords, or other secrets.

#### Scenario: Decryption error message
- **WHEN** decryption fails due to wrong password
- **THEN** the error message SHALL say "Invalid password or corrupted keystore" without revealing key material

#### Scenario: Transaction error message
- **WHEN** a transaction fails
- **THEN** the error message SHALL NOT contain the private key, signed transaction data, or password

### Requirement: Symlink attack prevention
The system SHALL not follow symbolic links for keystore storage.

#### Scenario: Keystore path is a symlink
- **WHEN** the keystore path points to a symbolic link
- **THEN** the system SHALL either refuse to write or resolve the real path and warn
