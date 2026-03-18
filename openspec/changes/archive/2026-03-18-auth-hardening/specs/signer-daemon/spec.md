## MODIFIED Requirements

### Requirement: Wallet creation in Signer
The Signer SHALL handle wallet creation internally without exposing the password to the Tool process. The Signer SHALL validate password strength before proceeding.

#### Scenario: create_wallet method
- **WHEN** the Tool sends `create_wallet` via IPC
- **THEN** the Signer SHALL prompt the user for a password through the configured AuthProvider, validate it against the password strength policy, require a second entry for confirmation, generate a private key, encrypt it, save the keystore, and return only the wallet address

#### Scenario: Wallet already exists
- **WHEN** `create_wallet` is called but a keystore already exists
- **THEN** the Signer SHALL return an error without prompting for password

#### Scenario: Weak password rejected during creation
- **WHEN** the user enters a password that fails the strength validator during wallet creation
- **THEN** the Signer SHALL display the validation error through the AuthProvider and prompt again

### Requirement: Wallet import in Signer
The Signer SHALL handle wallet import internally, collecting the private key through a secure user input channel. The Signer SHALL validate password strength for the new password.

#### Scenario: import_wallet method (interactive)
- **WHEN** the Tool sends `import_wallet` via IPC with no private key parameter
- **THEN** the Signer SHALL prompt the user for the private key and a new password through the AuthProvider, validate the new password strength, require confirmation entry, encrypt it, save the keystore, and return only the wallet address

#### Scenario: import_wallet from keystore file
- **WHEN** the Tool sends `import_wallet` with a `keystoreFile` path
- **THEN** the Signer SHALL read the file, prompt the user for the old password via AuthProvider, decrypt, prompt for a new password with strength validation and confirmation, re-encrypt, save, and return the address

### Requirement: Session management
The Signer SHALL cache the derived key in memory to avoid repeated scrypt computations. Large transactions SHALL bypass the session cache.

#### Scenario: Unlock creates session
- **WHEN** the user successfully enters password via `unlock`
- **THEN** the Signer SHALL derive the key via scrypt and cache the derivedKey in memory with a configurable TTL (default 30 minutes)

#### Scenario: Session expiry
- **WHEN** the session TTL expires
- **THEN** the Signer SHALL zero-fill the cached derivedKey and return to locked state

#### Scenario: Explicit lock
- **WHEN** `lock` is called
- **THEN** the Signer SHALL immediately zero-fill the cached derivedKey and return to locked state

#### Scenario: Process termination
- **WHEN** the Signer process is terminated (SIGTERM, SIGINT)
- **THEN** the Signer SHALL zero-fill the cached derivedKey before exiting and remove the socket file

#### Scenario: Level 2 transaction bypasses session
- **WHEN** a transaction requires Level 2 authorization (exceeds allowance thresholds or targets unknown recipient)
- **THEN** the Signer SHALL require the user to re-enter the password through the AuthProvider, regardless of whether a session is active
