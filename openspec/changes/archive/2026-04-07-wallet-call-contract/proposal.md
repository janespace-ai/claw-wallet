## Why

The agent currently has no way to interact with smart contracts beyond simple ETH/ERC-20 transfers. When users ask to swap tokens on Uniswap, stake on Aave, vote on a DAO, or interact with any DeFi protocol, the agent reports that it lacks the capability — even though the underlying wallet infrastructure (`wallet_send` with arbitrary calldata) already supports it.

The gap is **knowledge and tooling**, not infrastructure:
- The agent doesn't know it can encode and send arbitrary contract calls
- There is no tool exposing this capability with a usable interface
- The skill documentation doesn't mention DeFi or protocol interactions at all

Adding `wallet_call_contract` closes this gap and unlocks the full surface of on-chain interactions for the agent.

## What Changes

- **New tool: `wallet_call_contract`** — Encodes and sends arbitrary smart contract function calls using human-readable function signatures and typed arguments. Internally uses ethers.js ABI encoding, then routes through the existing signing flow (E2EE relay → desktop signing engine → blockchain).

- **Skill update: `claw-wallet/SKILL.md`** — Documents the new tool, explains when to use it vs `wallet_send`, and provides DeFi interaction patterns (approve + swap, stake, vote, etc.) so the agent knows how to handle protocol interactions.

## Capabilities

### New Capabilities
- `wallet-call-contract`: Call any smart contract function with ABI-encoded calldata

### Modified Capabilities
- `claw-wallet-skill`: Extended to cover DeFi interactions and arbitrary contract calls

## Impact

**Code Changes:**
- `agent/src/tools/wallet-call-contract.ts`: New tool — `wallet_call_contract`
- `agent/src/tool-registry.ts`: Register new tool in `createAllTools()`
- `skills/claw-wallet/SKILL.md`: Add tool docs, DeFi flows, contract interaction patterns

**No Breaking Changes** — existing tools and flows are unmodified.

## Non-Goals

- No Uniswap-specific `wallet_swap` tool (can be a future Protocol Skill on top of this)
- No EIP-712 typed data signing (separate change: `wallet-sign-typed-data`)
- No ABI file loading or contract registry
- No read-only contract calls (`eth_call`) — execution only
