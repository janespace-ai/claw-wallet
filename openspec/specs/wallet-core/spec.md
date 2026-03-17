## ADDED Requirements

### Requirement: Create new wallet
The system SHALL generate a new Ethereum wallet with a cryptographically secure random private key and return the wallet address.

#### Scenario: Successful wallet creation
- **WHEN** user invokes `wallet_create` with a master password
- **THEN** the system generates a new private key, encrypts it using Keystore V3 format (AES-256-GCM + scrypt KDF), saves the keystore file to `~/.openclaw/wallet/keystore.json`, and returns the new wallet address

#### Scenario: Wallet already exists
- **WHEN** user invokes `wallet_create` but a keystore file already exists
- **THEN** the system SHALL reject the request and inform the user that a wallet already exists, suggesting `wallet_import` to replace it

### Requirement: Import existing wallet
The system SHALL allow importing an existing wallet via private key or Keystore V3 file.

#### Scenario: Import via private key
- **WHEN** user invokes `wallet_import` with a raw private key and master password
- **THEN** the system encrypts the private key using Keystore V3 format, saves it, and returns the corresponding wallet address

#### Scenario: Import via keystore file
- **WHEN** user invokes `wallet_import` with a Keystore V3 JSON file and its password
- **THEN** the system validates the keystore, re-encrypts with the user's master password if different, saves it, and returns the wallet address

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
The system SHALL decrypt the private key only during transaction signing and immediately clear it from memory afterward.

#### Scenario: Sign and clear
- **WHEN** the system needs to sign a transaction
- **THEN** it decrypts the private key from keystore using the master password, signs the transaction, overwrites the key buffer with zeros, and returns only the signed transaction hash

### Requirement: Multi-chain RPC configuration
The system SHALL support configurable RPC endpoints for multiple EVM chains.

#### Scenario: Default chain configuration
- **WHEN** the system starts without custom RPC configuration
- **THEN** it SHALL use public RPC endpoints for Base and Ethereum mainnet

#### Scenario: Custom RPC endpoint
- **WHEN** user provides custom RPC URLs in configuration
- **THEN** the system SHALL use those endpoints instead of defaults
