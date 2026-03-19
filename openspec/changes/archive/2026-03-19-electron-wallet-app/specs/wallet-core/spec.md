## MODIFIED Requirements

### Requirement: Create new wallet
The wallet creation SHALL be performed entirely within the Electron Wallet App. The Agent Tool SHALL instruct the user to create a wallet in the Electron App and pair it.

#### Scenario: Successful wallet creation
- **WHEN** user invokes wallet_create
- **THEN** the Tool SHALL return a message instructing the user to create a wallet in the Electron Wallet App and use wallet_pair to connect it

#### Scenario: Wallet already paired
- **WHEN** user invokes wallet_create but a paired wallet already exists
- **THEN** the Tool SHALL inform the user that a wallet is already paired and provide the address

### Requirement: Import existing wallet
Wallet import SHALL be performed entirely within the Electron Wallet App. The Agent Tool SHALL instruct the user to import in the Electron App.

#### Scenario: Import via interactive input
- **WHEN** user invokes wallet_import
- **THEN** the Tool SHALL return a message instructing the user to import the wallet in the Electron Wallet App and use wallet_pair to connect it

### Requirement: Secure key signing
The Tool process SHALL send unsigned transaction parameters to the Signer, which SHALL forward them through the E2EE Relay to the Electron App for signing. The Tool SHALL NOT have access to the private key or password at any point.

#### Scenario: Sign and clear
- **WHEN** the system needs to sign a transaction
- **THEN** the Tool SHALL send the unsigned transaction parameters to the Signer via IPC, the Signer SHALL forward through E2EE to the Electron App, the Electron App SHALL sign and clear the key, and the signed transaction hex SHALL be returned through the chain back to the Tool

## ADDED Requirements

### Requirement: Wallet pairing tool
The system SHALL provide a wallet_pair Tool for connecting the Agent to an Electron Wallet App.

#### Scenario: Pair with short code
- **WHEN** user invokes wallet_pair with a pairing code
- **THEN** the Tool SHALL send the code to the Signer, which SHALL resolve it via Relay, complete the E2EE handshake, and return the paired wallet address

#### Scenario: No pairing code provided
- **WHEN** user invokes wallet_pair without a code
- **THEN** the Tool SHALL instruct the user to generate a pairing code in the Electron Wallet App first
