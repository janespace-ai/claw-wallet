## MODIFIED Requirements

### Requirement: Plugin lifecycle management
The system SHALL properly initialize and clean up resources during plugin lifecycle events. The plugin SHALL use `WalletConnection` for Relay communication instead of Unix Socket IPC to a Signer process.

#### Scenario: Plugin initialization
- **WHEN** the plugin is loaded
- **THEN** it SHALL verify the data directory exists (create if needed), create a `WalletConnection` instance configured with the Relay URL, load policy configuration, start the balance monitor, and register all tools

#### Scenario: Wallet not reachable at startup
- **WHEN** the plugin is loaded but the Desktop Wallet is not connected to the Relay
- **THEN** the plugin SHALL start successfully but return clear errors for operations requiring signing

#### Scenario: Plugin shutdown
- **WHEN** the plugin is unloaded
- **THEN** it SHALL stop the balance monitor, flush any pending history to disk, and release resources
