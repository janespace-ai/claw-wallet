## ADDED Requirements

### Requirement: Create new wallet
The system SHALL generate a new Ethereum wallet using BIP-39 mnemonic and BIP-44 derivation, and return the wallet address. The wallet creation SHALL be delegated to the Signer process; the Tool SHALL NOT handle passwords, private keys, or mnemonics.

#### Scenario: Successful wallet creation
- **WHEN** user invokes `wallet_create` (with no parameters)
- **THEN** the Tool SHALL send a `create_wallet` request to the Signer via IPC, the Signer SHALL prompt the user for a password through the AuthProvider, generate a BIP-39 mnemonic, derive the private key via BIP-44 path `m/44'/60'/0'/0/0`, encrypt the private key using Keystore V3 format, encrypt and save the mnemonic to `mnemonic.enc`, and the Tool SHALL receive and return only the new wallet address

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

### Requirement: Query wallet address
The system SHALL return the current wallet address without requiring the master password.

#### Scenario: Get address from existing wallet
- **WHEN** user invokes `wallet_address`
- **THEN** the system reads the address field from the keystore file and returns it (no decryption needed)

#### Scenario: No wallet configured
- **WHEN** user invokes `wallet_address` but no keystore exists
- **THEN** the system returns an error indicating no wallet is configured

### Requirement: Query balance
The system SHALL query the blockchain for the current balance of ETH and specified ERC-20 tokens.

#### Scenario: Query ETH balance
- **WHEN** user invokes `wallet_balance` without specifying a token
- **THEN** the system queries the configured chain's RPC node for the native ETH balance and returns the amount in human-readable format (e.g., "0.5 ETH")

#### Scenario: Query ERC-20 token balance
- **WHEN** user invokes `wallet_balance` with a token symbol (e.g., "USDC") or contract address
- **THEN** the system calls the token contract's `balanceOf` function and returns the balance with correct decimal formatting

#### Scenario: Query balance on specific chain
- **WHEN** user invokes `wallet_balance` with a chain parameter (e.g., "ethereum", "base")
- **THEN** the system queries the specified chain's RPC node for the balance

### Requirement: Gas estimation
The system SHALL estimate the gas cost for a transaction before execution.

#### Scenario: Estimate gas for ETH transfer
- **WHEN** user invokes `wallet_estimate_gas` with a transfer target and amount
- **THEN** the system returns the estimated gas cost in both native token units and approximate USD value

### Requirement: Secure key signing
The system SHALL sign transactions exclusively within the Signer process. The Tool process SHALL NOT have access to the private key or password at any point.

#### Scenario: Sign and clear
- **WHEN** the system needs to sign a transaction
- **THEN** the Tool SHALL send the unsigned transaction parameters to the Signer via IPC, the Signer SHALL decrypt the private key (using cached derivedKey if session is active, or prompting user), sign the transaction, overwrite the key buffer with zeros, and return only the signed transaction hex to the Tool

#### Scenario: Sign uses Buffer internally
- **WHEN** the private key is decrypted for signing
- **THEN** the internal flow SHALL prefer Buffer over Hex string to maximize clearable memory

### Requirement: Multi-chain RPC configuration
The system SHALL support configurable RPC endpoints for multiple EVM chains.

#### Scenario: Default chain configuration
- **WHEN** the system starts without custom RPC configuration
- **THEN** it SHALL use public RPC endpoints for Base and Ethereum mainnet

#### Scenario: Custom RPC endpoint
- **WHEN** user provides custom RPC URLs in configuration
- **THEN** the system SHALL use those endpoints instead of defaults

### Requirement: Private key entropy quality
Generated private keys SHALL have sufficient cryptographic entropy, derived from BIP-39 mnemonic phrases.

#### Scenario: Keys are derived from BIP-39 mnemonic via BIP-44
- **WHEN** `generateWalletWithMnemonic()` is called 100 times
- **THEN** all keys SHALL be unique and each SHALL be exactly 32 bytes (64 hex chars), derived via BIP-44 path `m/44'/60'/0'/0/0`

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

### Requirement: Keystore file permissions
The keystore file SHALL be written with restrictive permissions.

#### Scenario: File created with 0600 permissions
- **WHEN** `saveKeystore()` writes the keystore file
- **THEN** the file SHALL have permissions 0600 (owner read/write only)

#### Scenario: Existing file permissions preserved on update
- **WHEN** a keystore file is overwritten
- **THEN** the restrictive permissions SHALL be maintained

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

### Requirement: RPC timeout protection
RPC calls SHALL have timeout limits to prevent hanging.

#### Scenario: RPC endpoint unresponsive
- **WHEN** the RPC endpoint does not respond within 30 seconds
- **THEN** the system SHALL timeout and return an error

### Requirement: Gas estimation sanity check
Gas estimates from RPC SHALL be validated for reasonableness.

#### Scenario: Absurdly high gas estimate
- **WHEN** the RPC returns a gas estimate exceeding 30,000,000 (block gas limit)
- **THEN** the system SHALL warn or reject the transaction

#### Scenario: Zero gas estimate
- **WHEN** the RPC returns a gas estimate of 0
- **THEN** the system SHALL reject the estimate and return an error
