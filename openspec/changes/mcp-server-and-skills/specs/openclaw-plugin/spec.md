## MODIFIED Requirements

### Requirement: Plugin registration
The system SHALL register all wallet tools using a shared tool registry (`createAllTools`) that is reused by both the OpenClaw plugin and the MCP server. Tool parameter schemas SHALL NOT contain password or private key fields.

#### Scenario: Plugin loaded successfully
- **WHEN** OpenClaw loads the claw-wallet plugin
- **THEN** the following tools SHALL be available to the Agent: `wallet_create`, `wallet_import`, `wallet_address`, `wallet_balance`, `wallet_send`, `wallet_estimate_gas`, `wallet_history`, `wallet_contacts_list`, `wallet_contacts_add`, `wallet_contacts_resolve`, `wallet_contacts_remove`, `wallet_policy_get`, `wallet_policy_set`, `wallet_approval_list`, `wallet_approval_approve`, `wallet_approval_reject`
- **AND** `wallet_create` SHALL have zero required parameters
- **AND** `wallet_import` SHALL accept only an optional `keystoreFile` parameter
- **AND** no tool SHALL accept `password` or `private_key` parameters

#### Scenario: Shared registry consistency
- **WHEN** the OpenClaw plugin and MCP server both use `createAllTools()`
- **THEN** both SHALL expose the exact same set of tools with identical names, descriptions, and parameter schemas
