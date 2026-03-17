## ADDED Requirements

### Requirement: Plugin registration
The system SHALL register all wallet tools with the OpenClaw Plugin/Skill system on load.

#### Scenario: Plugin loaded successfully
- **WHEN** OpenClaw loads the claw-wallet plugin
- **THEN** the following tools SHALL be available to the Agent: `wallet_create`, `wallet_import`, `wallet_address`, `wallet_balance`, `wallet_send`, `wallet_estimate_gas`, `wallet_history`, `wallet_contacts_list`, `wallet_contacts_add`, `wallet_contacts_resolve`, `wallet_contacts_remove`, `wallet_policy_get`, `wallet_policy_set`, `wallet_approval_list`, `wallet_approval_approve`, `wallet_approval_reject`

### Requirement: Tool descriptions for LLM
Each registered tool SHALL have a clear description and parameter schema that enables the LLM to understand when and how to use it.

#### Scenario: LLM selects correct tool
- **WHEN** user says "check my balance"
- **THEN** the LLM SHALL select the `wallet_balance` tool based on its description

#### Scenario: LLM provides correct parameters
- **WHEN** user says "send 50 USDC to 0xABC on Base"
- **THEN** the LLM SHALL call `wallet_send` with parameters `{ to: "0xABC", amount: "50", token: "USDC", chain: "base" }`

### Requirement: Plugin configuration
The system SHALL support configuration through OpenClaw's plugin configuration mechanism.

#### Scenario: Configure RPC endpoints
- **WHEN** user sets custom RPC endpoints in plugin configuration
- **THEN** the wallet SHALL use those endpoints for blockchain queries

#### Scenario: Configure data directory
- **WHEN** user sets a custom data directory in plugin configuration
- **THEN** the wallet SHALL store keystore, contacts, history, and policy files in that directory instead of the default `~/.openclaw/wallet/`

### Requirement: Plugin lifecycle management
The system SHALL properly initialize and clean up resources during plugin lifecycle events.

#### Scenario: Plugin initialization
- **WHEN** the plugin is loaded
- **THEN** it SHALL verify the data directory exists (create if needed), load policy configuration, start the balance monitor, and register all tools

#### Scenario: Plugin shutdown
- **WHEN** the plugin is unloaded
- **THEN** it SHALL stop the balance monitor, flush any pending history to disk, and release resources

### Requirement: Error handling for missing wallet
The system SHALL handle gracefully when wallet operations are called before a wallet is created.

#### Scenario: Operation before wallet setup
- **WHEN** any wallet tool (except `wallet_create` and `wallet_import`) is called before a wallet is configured
- **THEN** the system SHALL return a clear error message: "No wallet configured. Use wallet_create or wallet_import first."
