## ADDED Requirements

### Requirement: Send native ETH
The system SHALL transfer native ETH to a specified address on the configured chain.

#### Scenario: Successful ETH transfer
- **WHEN** user invokes `wallet_send` with a recipient address, amount in ETH, and chain
- **THEN** the system builds the transaction, passes it through the Policy Engine, signs it, broadcasts to the network, waits for confirmation, and returns the transaction hash

#### Scenario: Insufficient ETH balance
- **WHEN** user invokes `wallet_send` but the wallet has insufficient ETH (including gas)
- **THEN** the system rejects the transaction before signing and returns an error with the current balance

### Requirement: Send ERC-20 tokens
The system SHALL transfer ERC-20 tokens (USDC, USDT, or any ERC-20 by contract address) to a specified address.

#### Scenario: Successful USDC transfer
- **WHEN** user invokes `wallet_send` with token "USDC", recipient address, and amount
- **THEN** the system resolves the USDC contract address for the target chain, builds an ERC-20 `transfer` call, passes through Policy Engine, signs, broadcasts, and returns the transaction hash

#### Scenario: Custom ERC-20 by contract address
- **WHEN** user invokes `wallet_send` with a token contract address instead of symbol
- **THEN** the system queries the contract for `decimals()` and `symbol()`, builds the transfer, and proceeds with the standard flow

#### Scenario: Insufficient token balance
- **WHEN** user invokes `wallet_send` but the wallet has insufficient token balance
- **THEN** the system rejects the transaction and returns an error with the current token balance

#### Scenario: Insufficient ETH for gas
- **WHEN** user invokes `wallet_send` for an ERC-20 transfer but the wallet has insufficient ETH for gas
- **THEN** the system rejects the transaction and returns an error indicating insufficient gas funds

### Requirement: Transaction status tracking
The system SHALL track transaction status after broadcast.

#### Scenario: Transaction confirmed
- **WHEN** a transaction is broadcast and confirmed on-chain
- **THEN** the system returns the transaction hash, block number, and gas used

#### Scenario: Transaction failed
- **WHEN** a broadcast transaction reverts on-chain
- **THEN** the system returns the transaction hash with a failure status and revert reason if available

### Requirement: Send to contact by name
The system SHALL resolve contact names to addresses when used as the recipient.

#### Scenario: Send to known contact
- **WHEN** user invokes `wallet_send` with a contact name (e.g., "trading-bot") instead of an address
- **THEN** the system resolves the name via the Contacts module, selects the address for the target chain, and proceeds with the transfer
