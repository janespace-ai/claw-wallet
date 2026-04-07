## Why

Modern DeFi protocols rely on EIP-712 typed data signing for their core interactions:

- **Hyperliquid**: Order placement and cancellation use EIP-712 signed messages sent to an HTTP API — no on-chain transaction required
- **Permit2 (Uniswap, Aave, etc.)**: Gasless ERC-20 approvals via `permit(owner, spender, value, deadline, v, r, s)` — used widely to eliminate a separate approve transaction
- **CoW Protocol, 1inch Fusion**: Off-chain order intents are EIP-712 signed
- **OpenSea Seaport**: NFT orders use typed data signing

The wallet currently supports only `sign_transaction` and `sign_message`. Any protocol requiring `eth_signTypedData_v4` is completely blocked — the signing engine throws `Unsupported signing method` and returns nothing.

This change adds EIP-712 typed data signing end-to-end: desktop signing engine, relay routing, agent tool, and skill documentation.

## What Changes

- **Desktop: `signing-engine.ts`** — Add `sign_typed_data` case using `ethers.Wallet.signTypedData(domain, types, value)`. Extends the budget/approval flow to handle typed data (no gas, no USD estimate from calldata).
- **Desktop: `relay-account-channel.ts`** — Route `sign_typed_data` requests through the existing `handleSignRequest` path. Adapt the request info extraction (no `to`, `value`, `token` fields — show domain name instead).
- **Agent: `wallet-sign-typed-data.ts`** — New tool `wallet_sign_typed_data` accepting `domain`, `types`, `value` and returning the hex `signature`.
- **Agent: `tool-registry.ts`** — Register the new tool.
- **Skill: `claw-wallet/SKILL.md`** — Document the tool with usage patterns for Hyperliquid order signing and Permit2.

## Capabilities

### New Capabilities
- `eip-712-signing`: Sign EIP-712 typed data messages in the desktop app, triggered by the agent

### Modified Capabilities
- `signing-engine`: Extended to support `sign_typed_data` method alongside existing `sign_transaction` and `sign_message`
- `claw-wallet-skill`: Extended with `wallet_sign_typed_data` tool and DeFi signing patterns

## Impact

**Code Changes:**
- `desktop/src/main/signing-engine.ts`: Add `sign_typed_data` handling in `signDirectly()` and budget logic
- `desktop/src/main/relay-account-channel.ts`: Adapt `handleSignRequest()` for typed data request info
- `agent/src/tools/wallet-sign-typed-data.ts`: New tool
- `agent/src/tool-registry.ts`: Register new tool
- `skills/claw-wallet/SKILL.md`: Document tool + Hyperliquid / Permit2 flows

**No Breaking Changes** — existing `sign_transaction` and `sign_message` flows unchanged.

## Non-Goals

- No DApp browser integration or WalletConnect (separate change)
- No automatic Hyperliquid SDK integration (agent constructs typed data manually using the skill guide)
- No typed data display decoding in the desktop approval UI (show raw JSON, future enhancement)
- No read-only `eth_call` view functions
