## Why

Currently, Agent and Desktop have no way to configure Web3 RPC endpoints at startup. They rely on hardcoded defaults from viem, which doesn't support local development environments or custom RPC providers. This blocks local testing and production deployments that require specific RPC providers.

## What Changes

- Add `chains` configuration to Agent config.json supporting custom RPC URLs for ethereum and base networks
- Add `chains` configuration to Desktop config.json to support future query capabilities (transaction details, gas estimates, balance display)
- Provide two reference configuration sets:
  - Production config using official RPC endpoints (mainnet.base.org, ethereum.publicnode.com)
  - Local development config pointing to localhost nodes (8545 for ethereum, 8546 for base)
- Update MCP Server initialization to read and pass chain configurations
- Update ClawWallet and Desktop initialization to use configured RPC URLs

## Capabilities

### New Capabilities
- `web3-config`: Configuration system for Web3 network RPC endpoints in both Agent and Desktop applications, supporting multiple environments (production, local development)

### Modified Capabilities
<!-- No existing capabilities are being modified at the requirement level -->

## Impact

**Agent**:
- `agent/src/index.ts` - ClawWallet initialization
- `agent/mcp-server/src/index.ts` - Config loading and passing
- `agent/config.example.json` - Add chains configuration
- New files: `config.prod.example.json`, `config.local.example.json`

**Desktop**:
- `desktop/src/main/config.ts` - Config type definitions and loading
- `desktop/src/main/index.ts` - Initialization with chain config
- `desktop/config.example.json` - Add chains configuration  
- New files: `config.prod.example.json`, `config.local.example.json`

**Documentation**:
- Setup guides need updates for local development workflow
- MCP Server configuration examples
