## MODIFIED Requirements

### Requirement: Signer daemon process isolation
The Signer SHALL run as a lightweight relay process that holds zero key material. It SHALL forward signing requests to the paired Electron App via the Go Relay Server using E2EE communication. The Signer SHALL still communicate with Tools via Unix Domain Socket JSON-RPC 2.0.

#### Scenario: Signer starts and listens on Unix Socket
- **WHEN** claw-signer start is executed
- **THEN** the Signer SHALL create a Unix Domain Socket at a well-known path with permissions 0600 and establish a WebSocket connection to the configured Relay Server

#### Scenario: Tool process connects to Signer
- **WHEN** a Tool needs to perform a signing operation
- **THEN** the Tool SHALL connect to the Signer via Unix Domain Socket, the Signer SHALL forward the request through the E2EE channel to the Electron App, and return the response

#### Scenario: Signer not running
- **WHEN** a Tool attempts to connect and the Signer is not running
- **THEN** the Tool SHALL return a clear error: "Signer not running. Start with claw-signer start"

#### Scenario: Electron App not connected
- **WHEN** a Tool sends a signing request but the Electron App is not connected via Relay
- **THEN** the Signer SHALL return an error: "Wallet app is offline. Please ensure the Electron Wallet App is running and connected."

### Requirement: Wallet creation delegation
The Signer SHALL NOT handle wallet creation locally. Wallet creation SHALL be performed in the Electron App. The Signer SHALL inform Tools to instruct the user to create a wallet in the Electron App.

#### Scenario: create_wallet method
- **WHEN** the Tool sends create_wallet via IPC
- **THEN** the Signer SHALL return a message: "Please create your wallet in the Electron Wallet App"

### Requirement: Wallet pairing
The Signer SHALL support pairing with an Electron Wallet App using short codes.

#### Scenario: wallet_pair method
- **WHEN** the Tool sends wallet_pair with a shortCode parameter
- **THEN** the Signer SHALL resolve the short code via the Relay, perform the E2EE handshake, exchange machineIds, persist the pairing info locally, and return the paired wallet address

#### Scenario: Already paired
- **WHEN** wallet_pair is called but a pairing already exists
- **THEN** the Signer SHALL return the existing paired wallet address and a message indicating already paired

### Requirement: Transaction signing via relay
The Signer SHALL forward signing requests to the Electron App through the E2EE channel and return the signed transaction.

#### Scenario: sign_transaction method
- **WHEN** the Tool sends sign_transaction with transaction parameters
- **THEN** the Signer SHALL encrypt the request, forward it to the Electron App via Relay, wait for the signed transaction response (or rejection/timeout), and return the result to the Tool

#### Scenario: Signing timeout
- **WHEN** the Electron App does not respond within 120 seconds
- **THEN** the Signer SHALL return a timeout error to the Tool

### Requirement: Address query from pairing
The Signer SHALL return the wallet address from the local pairing configuration without contacting the Electron App.

#### Scenario: get_address method
- **WHEN** get_address is called
- **THEN** the Signer SHALL return the wallet address stored in the pairing configuration file

#### Scenario: No pairing exists
- **WHEN** get_address is called but no pairing has been established
- **THEN** the Signer SHALL return an error: "No wallet paired. Use wallet_pair to connect an Electron Wallet App."

## REMOVED Requirements

### Requirement: Wallet creation in Signer
**Reason**: Wallet creation is now handled entirely by the Electron Wallet App. The Signer no longer has access to key material.
**Migration**: Users create wallets in the Electron App and pair with the Agent using wallet_pair.

### Requirement: Mnemonic export in Signer
**Reason**: Mnemonic management is now handled entirely by the Electron Wallet App.
**Migration**: Users export mnemonics directly from the Electron App UI.

### Requirement: Wallet import in Signer
**Reason**: Wallet import is now handled entirely by the Electron Wallet App.
**Migration**: Users import wallets in the Electron App and pair with the Agent using wallet_pair.

### Requirement: Session management
**Reason**: Key caching and session management are now handled by the Electron Wallet App. The Signer holds no key material.
**Migration**: Session and lock behavior is managed in the Electron App settings.
