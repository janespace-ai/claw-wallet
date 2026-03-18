## ADDED Requirements

### Requirement: Send native ETH
The system SHALL transfer native ETH to a specified address on the configured chain. Transaction signing SHALL be delegated to the Signer process via IPC.

#### Scenario: Successful ETH transfer
- **WHEN** user invokes `wallet_send` with a recipient address, amount in ETH, and chain
- **THEN** the system builds the unsigned transaction, passes it through the application-layer Policy Engine, sends it to the Signer for signing (which applies its own Allowance policy and may prompt the user), broadcasts the signed transaction to the network, waits for confirmation, and returns the transaction hash

#### Scenario: Signer rejects signing
- **WHEN** the system sends a transaction to the Signer for signing and the user rejects the confirmation prompt (or it times out)
- **THEN** the system SHALL return an error indicating the transaction was rejected by the user, without exposing any details about the signing process

#### Scenario: Insufficient ETH balance
- **WHEN** user invokes `wallet_send` but the wallet has insufficient ETH (including gas)
- **THEN** the system rejects the transaction before signing and returns an error with the current balance

### Requirement: Send ERC-20 tokens
The system SHALL transfer ERC-20 tokens (USDC, USDT, or any ERC-20 by contract address) to a specified address. Transaction signing SHALL be delegated to the Signer process via IPC.

#### Scenario: Successful USDC transfer
- **WHEN** user invokes `wallet_send` with token "USDC", recipient address, and amount
- **THEN** the system resolves the USDC contract address for the target chain, builds an ERC-20 `transfer` call, passes through application-layer Policy Engine, sends to Signer for signing, broadcasts, and returns the transaction hash

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

### Requirement: Address format validation
All address inputs SHALL be validated for correct format and checksum.

#### Scenario: Valid checksummed address accepted
- **WHEN** a valid EIP-55 checksummed address is provided
- **THEN** the system SHALL accept it

#### Scenario: Invalid hex characters rejected
- **WHEN** an address containing non-hex characters (e.g., "0xGGGG...") is provided
- **THEN** the system SHALL reject it with a clear error message

#### Scenario: Wrong length rejected
- **WHEN** an address with fewer or more than 40 hex chars is provided
- **THEN** the system SHALL reject it

#### Scenario: Invalid checksum rejected
- **WHEN** an address with incorrect EIP-55 checksum is provided (mixed case but wrong)
- **THEN** the system SHALL reject it with a checksum error

#### Scenario: All-lowercase accepted (no checksum)
- **WHEN** an all-lowercase address (e.g., "0xabcd...") is provided
- **THEN** the system SHALL accept it (no checksum to verify)

### Requirement: Amount boundary validation
All amount inputs SHALL be validated for safe numeric ranges.

#### Scenario: Zero amount rejected
- **WHEN** amount "0" is provided for a transfer
- **THEN** the system SHALL reject it

#### Scenario: Negative amount rejected
- **WHEN** amount "-1" is provided
- **THEN** the system SHALL reject it

#### Scenario: NaN rejected
- **WHEN** amount "abc" or "NaN" is provided
- **THEN** the system SHALL reject it with "Invalid amount"

#### Scenario: Infinity rejected
- **WHEN** amount "Infinity" or "1e999" is provided
- **THEN** the system SHALL reject it

#### Scenario: Extremely large amount handled
- **WHEN** amount "999999999999999999999999" is provided
- **THEN** the system SHALL handle it without overflow (BigInt-safe parsing)

### Requirement: Transaction broadcast verification
After broadcasting, the system SHALL verify the transaction was accepted.

#### Scenario: Transaction rejected by network
- **WHEN** `sendRawTransaction` is rejected by the RPC node
- **THEN** the system SHALL return a clear error with the rejection reason

#### Scenario: Receipt indicates failure
- **WHEN** the transaction receipt shows `status: "reverted"`
- **THEN** the system SHALL record the failure and return the revert reason if available
