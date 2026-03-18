### Requirement: Signer daemon process isolation
The Signer SHALL run as an independent daemon process, completely separate from the Agent/Tool process, and SHALL be the only component that holds keystore files and private key material.

#### Scenario: Signer starts and listens on Unix Socket
- **WHEN** `claw-signer start` is executed
- **THEN** the Signer SHALL create a Unix Domain Socket at a well-known path (e.g., `/tmp/claw-signer-<uid>.sock`) with permissions 0600

#### Scenario: Tool process connects to Signer
- **WHEN** a Tool needs to perform a signing operation
- **THEN** the Tool SHALL connect to the Signer via Unix Domain Socket and send a JSON-RPC 2.0 request

#### Scenario: Signer not running
- **WHEN** a Tool attempts to connect and the Signer is not running
- **THEN** the Tool SHALL return a clear error: "Signer not running. Start with `claw-signer start`"

### Requirement: IPC protocol
The Signer SHALL communicate via JSON-RPC 2.0 over Unix Domain Socket.

#### Scenario: Valid JSON-RPC request
- **WHEN** a valid JSON-RPC request is received with a supported method
- **THEN** the Signer SHALL return a JSON-RPC response with the result

#### Scenario: Unknown method
- **WHEN** a JSON-RPC request with an unknown method is received
- **THEN** the Signer SHALL return a JSON-RPC error with code -32601 (Method not found)

#### Scenario: Malformed request
- **WHEN** a non-JSON or malformed JSON-RPC request is received
- **THEN** the Signer SHALL return a JSON-RPC error with code -32700 (Parse error) and SHALL NOT crash

### Requirement: Wallet creation in Signer
The Signer SHALL handle wallet creation internally without exposing the password to the Tool process. The Signer SHALL validate password strength before proceeding. The Signer SHALL use BIP-39 mnemonic generation and store both the keystore and encrypted mnemonic.

#### Scenario: create_wallet method
- **WHEN** the Tool sends `create_wallet` via IPC
- **THEN** the Signer SHALL prompt the user for a password through the configured AuthProvider, validate it against the password strength policy, require a second entry for confirmation, generate a BIP-39 mnemonic and derive the private key via BIP-44, encrypt the private key and save the keystore, encrypt and save the mnemonic to `mnemonic.enc`, and return only the wallet address

#### Scenario: Wallet already exists
- **WHEN** `create_wallet` is called but a keystore already exists
- **THEN** the Signer SHALL return an error without prompting for password

#### Scenario: Weak password rejected during creation
- **WHEN** the user enters a password that fails the strength validator during wallet creation
- **THEN** the Signer SHALL display the validation error through the AuthProvider and prompt again

### Requirement: Mnemonic export in Signer
The Signer SHALL support exporting the mnemonic phrase to the user without transmitting it over IPC.

#### Scenario: export_mnemonic method
- **WHEN** the Tool sends `export_mnemonic` via IPC
- **THEN** the Signer SHALL prompt for password via AuthProvider (Level 2), decrypt `mnemonic.enc`, display the mnemonic through `displaySecretToUser` on the AuthProvider, and return `{ exported: true }` over IPC without including the mnemonic content

#### Scenario: export_mnemonic without mnemonic file
- **WHEN** `export_mnemonic` is called but no `mnemonic.enc` exists
- **THEN** the Signer SHALL return an error: "No mnemonic available"

#### Scenario: export_mnemonic with rate limiting
- **WHEN** `export_mnemonic` is called
- **THEN** the Signer SHALL apply rate limiting checks before prompting for password

### Requirement: Wallet import in Signer
The Signer SHALL handle wallet import internally, collecting the private key through a secure user input channel. The Signer SHALL validate password strength for the new password.

#### Scenario: import_wallet method (interactive)
- **WHEN** the Tool sends `import_wallet` via IPC with no private key parameter
- **THEN** the Signer SHALL prompt the user for the private key and a new password through the AuthProvider, validate the new password strength, require confirmation entry, encrypt it, save the keystore, and return only the wallet address

#### Scenario: import_wallet from keystore file
- **WHEN** the Tool sends `import_wallet` with a `keystoreFile` path
- **THEN** the Signer SHALL read the file, prompt the user for the old password via AuthProvider, decrypt, prompt for a new password with strength validation and confirmation, re-encrypt, save, and return the address

### Requirement: Transaction signing in Signer
The Signer SHALL sign transactions internally and return only the signed transaction bytes.

#### Scenario: sign_transaction method
- **WHEN** the Tool sends `sign_transaction` with transaction parameters (to, value, gas, chainId, data)
- **THEN** the Signer SHALL evaluate the allowance policy, potentially prompt the user, decrypt the private key, sign, clear the key from memory, and return the signed transaction hex

#### Scenario: Signer is locked
- **WHEN** `sign_transaction` is called but the Signer is in locked state and the transaction does not match allowance
- **THEN** the Signer SHALL prompt the user to unlock via the AuthProvider before proceeding

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

### Requirement: Address query without authentication
The Signer SHALL return the wallet address without requiring authentication.

#### Scenario: get_address method
- **WHEN** `get_address` is called
- **THEN** the Signer SHALL return the address from the keystore file without decrypting the private key
