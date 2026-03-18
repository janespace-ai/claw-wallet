## MODIFIED Requirements

### Requirement: Send native ETH
The system SHALL transfer native ETH to a specified address on the configured chain. Transaction signing SHALL be delegated to the Signer process via IPC.

#### Scenario: Successful ETH transfer
- **WHEN** user invokes `wallet_send` with a recipient address, amount in ETH, and chain
- **THEN** the system builds the unsigned transaction, passes it through the application-layer Policy Engine, sends it to the Signer for signing (which applies its own Allowance policy and may prompt the user), broadcasts the signed transaction to the network, waits for confirmation, and returns the transaction hash

#### Scenario: Signer rejects signing
- **WHEN** the system sends a transaction to the Signer for signing and the user rejects the confirmation prompt (or it times out)
- **THEN** the system SHALL return an error indicating the transaction was rejected by the user, without exposing any details about the signing process

### Requirement: Send ERC-20 tokens
The system SHALL transfer ERC-20 tokens to a specified address. Transaction signing SHALL be delegated to the Signer process via IPC.

#### Scenario: Successful USDC transfer
- **WHEN** user invokes `wallet_send` with token "USDC", recipient address, and amount
- **THEN** the system resolves the USDC contract address for the target chain, builds an ERC-20 `transfer` call, passes through application-layer Policy Engine, sends to Signer for signing, broadcasts, and returns the transaction hash
