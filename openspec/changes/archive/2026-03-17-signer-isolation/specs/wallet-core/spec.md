## MODIFIED Requirements

### Requirement: Create new wallet
The system SHALL generate a new Ethereum wallet with a cryptographically secure random private key and return the wallet address. The wallet creation SHALL be delegated to the Signer process; the Tool SHALL NOT handle passwords or private keys.

#### Scenario: Successful wallet creation
- **WHEN** user invokes `wallet_create` (with no parameters)
- **THEN** the Tool SHALL send a `create_wallet` request to the Signer via IPC, the Signer SHALL prompt the user for a PIN through the AuthProvider, generate a new private key, encrypt it using Keystore V3 format (AES-256-GCM + scrypt KDF), save the keystore file, and the Tool SHALL receive and return only the new wallet address

#### Scenario: Wallet already exists
- **WHEN** user invokes `wallet_create` but a keystore file already exists
- **THEN** the Signer SHALL reject the request and inform the user that a wallet already exists, suggesting `wallet_import` to replace it

### Requirement: Import existing wallet
The system SHALL allow importing an existing wallet. The private key and password SHALL only be entered through the Signer's secure AuthProvider interface; the Tool SHALL NOT accept private keys as parameters.

#### Scenario: Import via interactive input
- **WHEN** user invokes `wallet_import` (with no parameters)
- **THEN** the Tool SHALL send an `import_wallet` request to the Signer, the Signer SHALL prompt the user for the private key and a new PIN through the AuthProvider, encrypt and save it, and the Tool SHALL receive and return only the wallet address

#### Scenario: Import via keystore file
- **WHEN** user invokes `wallet_import` with a `keystoreFile` path parameter
- **THEN** the Tool SHALL send the file path to the Signer, the Signer SHALL prompt the user for the old password and a new PIN through the AuthProvider, decrypt, re-encrypt, save, and the Tool SHALL receive and return the wallet address

### Requirement: Secure key signing
The system SHALL sign transactions exclusively within the Signer process. The Tool process SHALL NOT have access to the private key or password at any point.

#### Scenario: Sign and clear
- **WHEN** the system needs to sign a transaction
- **THEN** the Tool SHALL send the unsigned transaction parameters to the Signer via IPC, the Signer SHALL decrypt the private key (using cached derivedKey if session is active, or prompting user), sign the transaction, overwrite the key buffer with zeros, and return only the signed transaction hex to the Tool
