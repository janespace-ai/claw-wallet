## MODIFIED Requirements

### Requirement: Create new wallet
The system SHALL generate a new Ethereum wallet using BIP-39 mnemonic and BIP-44 derivation, and return the wallet address. The wallet creation SHALL be delegated to the Signer process; the Tool SHALL NOT handle passwords, private keys, or mnemonics.

#### Scenario: Successful wallet creation
- **WHEN** user invokes `wallet_create` (with no parameters)
- **THEN** the Tool SHALL send a `create_wallet` request to the Signer via IPC, the Signer SHALL prompt the user for a password through the AuthProvider, generate a BIP-39 mnemonic, derive the private key via BIP-44 path `m/44'/60'/0'/0/0`, encrypt the private key using Keystore V3 format, encrypt and save the mnemonic to `mnemonic.enc`, and the Tool SHALL receive and return only the new wallet address

#### Scenario: Wallet already exists
- **WHEN** user invokes `wallet_create` but a keystore file already exists
- **THEN** the Signer SHALL reject the request and inform the user that a wallet already exists, suggesting `wallet_import` to replace it

### Requirement: Private key entropy quality
Generated private keys SHALL have sufficient cryptographic entropy, derived from BIP-39 mnemonic phrases.

#### Scenario: Keys are derived from BIP-39 mnemonic via BIP-44
- **WHEN** `generateWalletWithMnemonic()` is called 100 times
- **THEN** all keys SHALL be unique and each SHALL be exactly 32 bytes (64 hex chars), derived via BIP-44 path `m/44'/60'/0'/0/0`

#### Scenario: No predictable patterns
- **WHEN** 100 private keys are generated
- **THEN** no two consecutive keys SHALL share more than 4 leading hex characters
