## MODIFIED Requirements

### Requirement: Signer daemon process isolation
The Agent SDK SHALL provide a `WalletConnection` class that communicates with the Desktop Wallet via the Relay Server's HTTP bridge endpoint. The `WalletConnection` SHALL hold zero key material in long-term memory; it SHALL derive E2EE session keys on-demand from stored pairing credentials for each request.

#### Scenario: Agent sends signing request
- **WHEN** a tool needs to perform a signing operation
- **THEN** the tool SHALL call `WalletConnection.sendToWallet(method, params)`, which encrypts the request, sends it via HTTP to the Relay, and returns the decrypted response

#### Scenario: Wallet not connected
- **WHEN** a tool sends a request but the Wallet is not connected to the Relay
- **THEN** the `WalletConnection` SHALL return an error: "Wallet app is offline. Please ensure the Desktop Wallet is running."

#### Scenario: No pairing exists
- **WHEN** a tool sends a request but no pairing has been established
- **THEN** the `WalletConnection` SHALL return an error: "No wallet paired. Use wallet_pair to connect a Desktop Wallet."

### Requirement: Wallet pairing
The `WalletConnection` SHALL support pairing with a Desktop Wallet using short codes via the Relay Server's HTTP API.

#### Scenario: wallet_pair method
- **WHEN** `pair(shortCode)` is called
- **THEN** the `WalletConnection` SHALL resolve the short code via `GET /pair/{code}`, generate or load an X25519 keypair, derive the pairId and shared key, send an encrypted `pair_complete` message via the HTTP bridge, persist the pairing info locally, and return the paired wallet address

### Requirement: Address query from pairing
The `WalletConnection` SHALL return the wallet address from the local pairing configuration without contacting the Relay.

#### Scenario: get_address method
- **WHEN** `getAddress()` is called
- **THEN** the `WalletConnection` SHALL return the wallet address stored in the pairing configuration file

#### Scenario: No pairing exists
- **WHEN** `getAddress()` is called but no pairing has been established
- **THEN** the `WalletConnection` SHALL return null

## REMOVED Requirements

### Requirement: Signer daemon process isolation
**Reason**: The RelaySigner daemon and Unix Socket IPC protocol are replaced by the in-process `WalletConnection` class that communicates via HTTP. There is no longer a separate signer process.
**Migration**: Use `WalletConnection` directly from the SDK or MCP Server. No Unix Socket, no separate process startup.

### Requirement: Wallet creation delegation
**Reason**: The delegation message is now returned directly by the tool definition, not by a separate signer process.
**Migration**: Tool definitions return the delegation message inline.
