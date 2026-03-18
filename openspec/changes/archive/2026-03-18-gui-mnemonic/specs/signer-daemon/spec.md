## MODIFIED Requirements

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

## ADDED Requirements

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
