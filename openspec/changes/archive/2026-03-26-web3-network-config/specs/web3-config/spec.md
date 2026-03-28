## ADDED Requirements

### Requirement: Agent supports RPC configuration via config file

The Agent application SHALL read Web3 RPC URLs from a `chains` section in config.json and use them to initialize the ChainAdapter for ethereum and base networks.

#### Scenario: Agent starts with production RPC configuration
- **WHEN** config.json contains `chains.ethereum.rpcUrl` and `chains.base.rpcUrl`
- **THEN** ChainAdapter SHALL use these URLs instead of viem's default RPC endpoints

#### Scenario: Agent starts without chains configuration
- **WHEN** config.json does not contain `chains` section
- **THEN** ChainAdapter SHALL fall back to viem's built-in default RPC endpoints

#### Scenario: MCP Server passes chain configuration
- **WHEN** MCP Server starts and loads config.json
- **THEN** MCP Server SHALL pass `chains` configuration to ClawWallet constructor

### Requirement: Desktop supports RPC configuration via config file

The Desktop application SHALL read Web3 RPC URLs from a `chains` section in config.json to prepare for future query capabilities.

#### Scenario: Desktop starts with chains configuration
- **WHEN** config.json contains `chains.ethereum.rpcUrl` and `chains.base.rpcUrl`  
- **THEN** Desktop SHALL store these configurations for future use

#### Scenario: Desktop starts without chains configuration
- **WHEN** config.json does not contain `chains` section
- **THEN** Desktop SHALL continue to operate normally without RPC connectivity

### Requirement: Production configuration examples

The system SHALL provide production-ready configuration examples using official RPC endpoints.

#### Scenario: User copies production example
- **WHEN** user copies config.prod.example.json to config.json
- **THEN** configuration SHALL use mainnet.base.org for base and ethereum.publicnode.com for ethereum

### Requirement: Local development configuration examples

The system SHALL provide local development configuration examples for testing with local nodes.

#### Scenario: User copies local example  
- **WHEN** user copies config.local.example.json to config.json
- **THEN** configuration SHALL use localhost:8545 for ethereum and localhost:8546 for base

#### Scenario: User starts local nodes with correct chainIds
- **WHEN** user runs Hardhat with `--chain-id 1 --port 8545` for ethereum
- **THEN** Agent SHALL successfully connect to localhost:8545 as ethereum mainnet simulation

### Requirement: Configuration structure consistency

Agent and Desktop SHALL use identical configuration structure for chains.

#### Scenario: Same config works for both applications
- **WHEN** user creates a config.json with `chains` section
- **THEN** both Agent and Desktop SHALL parse and use the same configuration format

#### Scenario: Configuration format follows existing patterns
- **WHEN** user examines config.json structure
- **THEN** `chains` section SHALL be nested at root level alongside `relayUrl` and other settings
