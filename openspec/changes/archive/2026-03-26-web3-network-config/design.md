## Context

Currently, both Agent and Desktop applications hardcode Web3 network connectivity through viem's default configurations. Agent uses ChainAdapter with hardcoded chain objects from `viem/chains`, while Desktop only signs transactions without any RPC connectivity. This creates friction for:
- Local development requiring connection to test networks (Hardhat/Anvil)
- Production deployments needing specific RPC providers
- Future Desktop features requiring chain queries (gas estimates, transaction details, balance display)

The codebase already has partial support through ClawWallet's `chains` constructor parameter, but it's not exposed through configuration files or environment variables.

## Goals / Non-Goals

**Goals:**
- Enable RPC configuration through config.json files for both Agent and Desktop
- Provide production and local development configuration examples
- Support Agent's immediate need for configurable RPC endpoints
- Prepare Desktop for future query capabilities with same configuration structure
- Maintain backward compatibility (default to viem's built-in RPC if not configured)

**Non-Goals:**
- Environment variable support for RPC URLs (config file only for now)
- Support for chains beyond ethereum and base
- Custom chain definitions with custom chainIds
- Desktop query implementation (only configuration preparation)

## Decisions

### Decision 1: Configuration File Structure

**Choice**: Nest `chains` object directly in main config.json

```json
{
  "relayUrl": "...",
  "chains": {
    "ethereum": { "rpcUrl": "https://..." },
    "base": { "rpcUrl": "https://..." }
  }
}
```

**Alternatives considered**:
- Separate `chains.json` file - rejected for simplicity, keeps all config in one place
- Environment variables (BASE_RPC_URL, ETH_RPC_URL) - rejected to avoid complexity, config file sufficient

**Rationale**: Keeps configuration centralized, follows existing patterns in the codebase, easier to template and version control.

### Decision 2: Two Example Configuration Sets

**Choice**: Provide `config.prod.example.json` and `config.local.example.json`

- **Production**: Official RPC endpoints (mainnet.base.org, ethereum.publicnode.com)
- **Local**: localhost endpoints (8545 for ethereum, 8546 for base)

**Rationale**: Clear separation makes it obvious which config to use, easy to copy and customize for different environments.

### Decision 3: Local Node Configuration

**Choice**: Use localhost:8545 for ethereum and localhost:8546 for base, expecting developers to start Hardhat/Anvil with matching chainIds:

```bash
# Ethereum mainnet simulation
npx hardhat node --chain-id 1 --port 8545

# Base mainnet simulation  
npx hardhat node --chain-id 8453 --port 8546
```

**Alternatives considered**:
- Custom chain definitions for local networks - rejected as too complex
- Single localhost node for both chains - rejected for clarity

**Rationale**: Keeps chain objects unchanged (still use viem/chains), only swaps RPC URL. Developer explicitly chooses chainId when starting local node.

### Decision 4: Desktop Configuration Now

**Choice**: Add chains configuration to Desktop config even though it's not used yet

**Rationale**: Future-proofing for planned query capabilities. Better to have consistent configuration structure across Agent and Desktop from the start rather than adding it later.

### Decision 5: MCP Server Configuration Loading

**Choice**: Add config file loading in `mcp-server/src/index.ts` that reads `config.json` from CWD and passes `chains` to ClawWallet constructor

**Alternatives considered**:
- Keep environment variables only - rejected, not flexible enough
- Read from DATA_DIR - rejected, config should be with the binary

**Rationale**: Follows pattern of other config loading, works with direct SDK usage too.

## Risks / Trade-offs

**Risk**: User starts local node with wrong chainId (e.g., default 31337 instead of 1)  
→ **Mitigation**: Clear documentation in config.local.example.json with exact command to run. Viem will catch chainId mismatches at transaction time.

**Risk**: Desktop's chain configuration goes unused initially, may drift from Agent's  
→ **Mitigation**: Use same configuration structure and examples for both. When Desktop adds queries, it's already consistent.

**Risk**: Config file in CWD may not be found if MCP server runs from different directory  
→ **Mitigation**: Document expected working directory in setup guides. MCP servers typically run from project root.

**Trade-off**: Only supporting config file (not environment variables) means less flexibility  
→ **Acceptable**: Config file is standard for this use case, can add env vars later if needed.

**Trade-off**: Not validating RPC URLs at startup  
→ **Acceptable**: Will fail at first network call with clear error. Early validation adds complexity.
