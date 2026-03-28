## 1. Agent Configuration Files

- [x] 1.1 Create config.prod.example.json with production RPC URLs (mainnet.base.org, ethereum.publicnode.com)
- [x] 1.2 Create config.local.example.json with localhost RPC URLs (8545 for ethereum, 8546 for base)
- [x] 1.3 Update config.example.json to include chains configuration with comments explaining structure
- [x] 1.4 Add documentation comments in local config about starting Hardhat nodes with correct chainIds

## 2. Agent MCP Server Configuration Loading

- [x] 2.1 Add loadConfig() function in mcp-server/src/index.ts to read config.json from CWD
- [x] 2.2 Extract chains configuration from loaded config
- [x] 2.3 Pass chains configuration to ClawWallet constructor
- [x] 2.4 Maintain backward compatibility when chains config is not present

## 3. Desktop Configuration Files

- [x] 3.1 Create desktop/config.prod.example.json with production RPC URLs
- [x] 3.2 Create desktop/config.local.example.json with localhost RPC URLs
- [x] 3.3 Update desktop/config.example.json to include chains configuration section
- [x] 3.4 Add TypeScript interface for chain configuration in desktop/src/main/config.ts

## 4. Desktop Configuration Loading

- [x] 4.1 Add chains field to Config interface in desktop/src/main/config.ts
- [x] 4.2 Update loadConfig() function to parse chains section
- [x] 4.3 Store chain configuration in Desktop app state for future use
- [x] 4.4 Add validation for chain configuration structure

## 5. Documentation

- [x] 5.1 Update agent/examples/README.md with RPC configuration examples
- [x] 5.2 Update agent/skills/claw-wallet-setup/SKILL.md with chains configuration instructions
- [x] 5.3 Add local development setup guide documenting Hardhat node commands
- [x] 5.4 Update main README.md with configuration section explaining both environments

## 6. Testing

- [x] 6.1 Test Agent with production config connecting to public RPCs
- [x] 6.2 Test Agent with local config connecting to Hardhat nodes
- [x] 6.3 Test MCP Server startup with and without chains configuration
- [x] 6.4 Test Desktop config parsing with chains section
- [x] 6.5 Verify backward compatibility when chains config is missing
- [x] 6.6 Test that direct SDK usage (ClawWallet constructor) still works with chains parameter
