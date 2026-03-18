### Requirement: BIP-39 mnemonic generation
The system SHALL generate wallets using BIP-39 mnemonic phrases as the entropy source.

#### Scenario: New wallet uses 12-word mnemonic
- **WHEN** `generateWalletWithMnemonic` is called
- **THEN** the system SHALL generate a cryptographically random 128-bit entropy, derive a 12-word BIP-39 English mnemonic, and return both the mnemonic and the derived private key/address

#### Scenario: Mnemonic produces valid BIP-44 key
- **WHEN** a mnemonic is generated
- **THEN** the system SHALL derive the private key using BIP-44 path `m/44'/60'/0'/0/0` and the resulting address SHALL be a valid EIP-55 checksummed Ethereum address

#### Scenario: Mnemonic is deterministic
- **WHEN** the same mnemonic is used to derive a wallet twice
- **THEN** both derivations SHALL produce the same private key and address

### Requirement: Mnemonic encrypted storage
The system SHALL encrypt and store the mnemonic separately from the keystore.

#### Scenario: Mnemonic saved as mnemonic.enc
- **WHEN** a wallet is created with a mnemonic
- **THEN** the system SHALL encrypt the mnemonic using AES-256-GCM with scrypt-derived key (same password as keystore) and save it to `mnemonic.enc` in the wallet data directory

#### Scenario: Mnemonic file permissions
- **WHEN** `mnemonic.enc` is written
- **THEN** the file SHALL have permissions 0600 (owner read/write only)

#### Scenario: Mnemonic decryption
- **WHEN** the correct password is provided for mnemonic decryption
- **THEN** the system SHALL return the original 12-word mnemonic string

#### Scenario: Wrong password for mnemonic
- **WHEN** an incorrect password is provided for mnemonic decryption
- **THEN** the system SHALL throw an error "Invalid password or corrupted mnemonic" without revealing any mnemonic content

### Requirement: Mnemonic secure export
The system SHALL support exporting the mnemonic to the user without exposing it to the Agent.

#### Scenario: Export mnemonic via GUI
- **WHEN** `export_mnemonic` RPC is called and GuiAuthProvider is configured
- **THEN** the Signer SHALL prompt for password via GUI, decrypt `mnemonic.enc`, display the mnemonic in a secure GUI dialog via `displaySecretToUser`, and return `{ exported: true }` over IPC without including the mnemonic

#### Scenario: Export mnemonic via TUI
- **WHEN** `export_mnemonic` RPC is called and TuiAuthProvider is configured
- **THEN** the Signer SHALL prompt for password via TTY, decrypt the mnemonic, display it directly to `/dev/tty`, and return `{ exported: true }` over IPC without including the mnemonic

#### Scenario: No mnemonic available
- **WHEN** `export_mnemonic` is called but no `mnemonic.enc` file exists (old wallet)
- **THEN** the Signer SHALL return an error: "No mnemonic available. This wallet was created without BIP-39 mnemonic support."

#### Scenario: Export mnemonic rate-limited
- **WHEN** `export_mnemonic` is called
- **THEN** the operation SHALL be subject to the same rate limiting as other Level 2 authentication operations
