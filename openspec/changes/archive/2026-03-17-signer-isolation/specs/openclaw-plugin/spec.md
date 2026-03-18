## MODIFIED Requirements

### Requirement: Plugin registration
The system SHALL register all wallet tools with the OpenClaw Plugin/Skill system on load. Tool parameter schemas SHALL NOT contain password or private key fields.

#### Scenario: Plugin loaded successfully
- **WHEN** OpenClaw loads the claw-wallet plugin
- **THEN** the following tools SHALL be available to the Agent: `wallet_create`, `wallet_import`, `wallet_address`, `wallet_balance`, `wallet_send`, `wallet_estimate_gas`, `wallet_history`, `wallet_contacts_list`, `wallet_contacts_add`, `wallet_contacts_resolve`, `wallet_contacts_remove`, `wallet_policy_get`, `wallet_policy_set`, `wallet_approval_list`, `wallet_approval_approve`, `wallet_approval_reject`
- **AND** `wallet_create` SHALL have zero required parameters
- **AND** `wallet_import` SHALL accept only an optional `keystoreFile` parameter
- **AND** no tool SHALL accept `password` or `private_key` parameters

### Requirement: Plugin lifecycle management
The system SHALL properly initialize and clean up resources during plugin lifecycle events, including connection to the Signer process.

#### Scenario: Plugin initialization
- **WHEN** the plugin is loaded
- **THEN** it SHALL verify the data directory exists (create if needed), connect to the Signer process via Unix Socket IPC, load policy configuration, start the balance monitor, and register all tools

#### Scenario: Signer not available at startup
- **WHEN** the plugin is loaded but the Signer process is not running
- **THEN** the plugin SHALL start successfully but return clear errors for operations requiring signing, and SHALL attempt to auto-start the Signer if configured

#### Scenario: Plugin shutdown
- **WHEN** the plugin is unloaded
- **THEN** it SHALL disconnect from the Signer, stop the balance monitor, flush any pending history to disk, and release resources
