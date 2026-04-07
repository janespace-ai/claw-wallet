## Context

**Current Architecture:**
- `wallet_send` handles ETH/ERC-20 transfers via `TransferService`
- `TransferService` builds transaction objects and sends them through the relay → desktop signing flow
- The relay delivers signed transactions to the desktop app, which submits them on-chain
- `wallet_send` only exposes a high-level `(to, amount, token, chain)` interface — no `data` field

**Target:**
- Add `wallet_call_contract` that accepts a contract address, human-readable function signature, and typed arguments
- Encode arguments with ethers.js `Interface`, produce `data` hex
- Send via the existing relay signing flow (same path as `wallet_send`)
- Update `SKILL.md` so the agent knows when and how to use it

## Goals / Non-Goals

**Goals:**
- Accept human-readable function signatures (e.g. `"approve(address,uint256)"`)
- Accept typed args as a JSON array (strings, numbers, booleans, address strings)
- Encode with `ethers.Interface.encodeFunctionData`
- Send optional ETH value (for payable functions)
- Route through relay → desktop signing → broadcast (same flow as existing tools)
- Document in skill: when to use, common patterns, known protocol addresses

**Non-Goals:**
- ABI file loading (inline signature string is sufficient)
- Read-only `eth_call` (view functions)
- EIP-712 typed data signing
- Protocol-specific tools (Uniswap, Aave) — those are future Protocol Skills built on top of this

## Decisions

### Decision 1: Interface — Human-readable signatures, not full ABI JSON

**Choice:** `functionSignature` string (e.g. `"approve(address,uint256)"`) instead of full ABI JSON array.

**Rationale:**
- LLMs can produce and read function signatures easily
- ethers.js `Interface` accepts human-readable signatures directly
- Avoids requiring the agent to produce verbose ABI JSON
- For complex return types, the signature still captures everything needed for encoding

**Example:**
```typescript
const iface = new ethers.Interface(["function approve(address spender, uint256 amount)"]);
const data = iface.encodeFunctionData("approve", [spenderAddress, amount]);
```

### Decision 2: Args as JSON array

**Choice:** `args` is a JSON array string, agent passes `"[\"0xABC...\", \"1000000\"]"`

**Rationale:**
- JSON is a natural format for LLMs to produce
- Parsed with `JSON.parse` before passing to ethers
- Handles all primitive types: address strings, uint256 as decimal strings, booleans
- For structs/tuples, ethers accepts nested arrays matching the tuple order

**Type coercion rules:**
- Addresses: pass as `"0x..."` strings
- uint256/int256: pass as decimal strings (avoids JS BigInt overflow)
- bytes32: pass as `"0x..."` hex strings
- bool: pass as JSON boolean `true`/`false`
- Struct/tuple: pass as nested array

### Decision 3: Route through TransferService / relay, not a new signing path

**Choice:** Build a `TransactionRequest` object with `data` set, pass to `walletConnection.sendToWallet("wallet_send", ...)` directly (bypassing TransferService's token-specific logic).

**Rationale:**
- TransferService knows about ERC-20 vs ETH but not arbitrary calldata
- The relay's `wallet_send` RPC method on the desktop side handles raw transactions
- Re-using the same relay RPC keeps signing, approval, and history tracking consistent
- No new desktop-side changes needed

**Flow:**
```
wallet_call_contract (agent)
  → ethers.Interface.encodeFunctionData(sig, args)
  → walletConnection.sendToWallet("wallet_send", {
      to, value, data, chain, ...
    })
  → relay → desktop signing engine
  → broadcast → return txHash
```

### Decision 4: Tool placement — `agent/src/tools/wallet-call-contract.ts`

Follows existing pattern: one file per tool, exports `createWalletCallContractTool(deps)`, registered in `tool-registry.ts`.

### Decision 5: Skill update strategy

Update `skills/claw-wallet/SKILL.md` with:
1. New row in Tools table for `wallet_call_contract`
2. New **"DeFi & Contract Interactions"** section with:
   - When to use `wallet_call_contract` vs `wallet_send`
   - Standard two-step approve + call pattern
   - Known contract addresses on Arbitrum/Base/Ethereum for common protocols
   - Example: Uniswap V3 swap, ERC-20 approve, generic staking

## Tool Interface

```typescript
// Tool name: wallet_call_contract
// Parameters:
{
  to: string;               // Contract address (required)
  functionSignature: string; // e.g. "approve(address,uint256)" (required)
  args: string;             // JSON array of arguments, e.g. '["0xABC", "1000000"]'
  value?: string;           // ETH to send in wei, as decimal string (optional, default "0")
  chain?: string;           // Chain name (optional, default: configured default)
}

// Returns (same as wallet_send):
{
  hash: string;
  status: string;
  blockNumber?: string;
  gasUsed?: string;
  message: string;
}
```

## Implementation Sketch

```typescript
// agent/src/tools/wallet-call-contract.ts

export function createWalletCallContractTool(deps: ToolDependencies): ToolDefinition {
  return {
    name: "wallet_call_contract",
    description: `
      Call any smart contract function on EVM chains. Use this for DeFi protocol
      interactions, token approvals, staking, governance voting, and any on-chain
      operation beyond simple token transfers.

      Provide:
      - Contract address
      - Human-readable function signature (e.g. "approve(address,uint256)")
      - Arguments as a JSON array

      Common two-step DeFi pattern:
      1. wallet_call_contract approve(spender, amount) on the token contract
      2. wallet_call_contract the protocol's method (swap, deposit, stake...)

      Examples:
      - ERC-20 approve: functionSignature="approve(address,uint256)", args=["0xRouter", "10000000"]
      - Uniswap swap: functionSignature="exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))", args=[[...]]
      - Stake tokens: functionSignature="stake(uint256)", args=["1000000000000000000"]
    `,
    parameters: { /* JSON schema */ },
    execute: async (args) => {
      const { to, functionSignature, args: argsJson, value, chain } = args;

      // Parse args
      const parsedArgs = JSON.parse(argsJson);

      // ABI encode
      const iface = new ethers.Interface([`function ${functionSignature}`]);
      const fnName = functionSignature.split("(")[0];
      const data = iface.encodeFunctionData(fnName, parsedArgs);

      // Send via relay
      const result = await deps.walletConnection.sendToWallet("wallet_send", {
        to, data, value: value ?? "0", chain: chain ?? deps.defaultChain,
      });

      return result;
    }
  };
}
```

## Skill Update Structure

```
## DeFi & Contract Interactions

Use `wallet_call_contract` when you need to interact with any smart contract
beyond simple token transfers — swaps, staking, voting, protocol deposits.

### Two-step approve + call pattern
Most DeFi interactions require approving the protocol to spend your tokens first:

1. wallet_call_contract: approve token spending
   - to: <token contract address>
   - functionSignature: "approve(address,uint256)"
   - args: ["<protocol address>", "<amount in token units>"]

2. wallet_call_contract: call the protocol
   - to: <protocol contract address>
   - functionSignature: "<method signature>"
   - args: [...]

### Known contract addresses (Arbitrum)
| Protocol | Contract | Address |
|----------|----------|---------|
| USDC | Token | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 |
| Uniswap V3 | SwapRouter | 0xE592427A0AEce92De3Edee1F18E0157C05861564 |
| Uniswap V3 | SwapRouter02 | 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45 |
| WETH | Token | 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 |
| Aave V3 | Pool | 0x794a61358D6845594F94dc1DB02A252b5b4814aD |
```

## Risks / Trade-offs

### Risk: Agent produces incorrect ABI encoding
**[Risk]** Wrong function signature or argument types cause `CALL_EXCEPTION` on-chain.

**[Mitigation]**
- ethers.js validation throws clearly on type mismatch before broadcast
- Desktop signing engine shows decoded calldata in approval dialog (future: decode on desktop)
- Skill provides known-good examples for common protocols

### Risk: Agent calls malicious contracts
**[Risk]** Adversarial input or prompt injection could direct agent to drain funds.

**[Trade-off]**
- Same risk exists with `wallet_send` today
- Desktop approval flow with USD estimate shown to user before signing
- Policy limits (per-tx and daily) provide a safety net
- Trusted contacts / address allowlist (future)

### Risk: Agent doesn't know current on-chain state (price, slippage)
**[Risk]** Hardcoded `amountOutMinimum: 0` risks sandwich attacks on swaps.

**[Mitigation]**
- Document in skill: always set a reasonable `amountOutMinimum` based on quoted price
- Future: add `wallet_quote_swap` tool for on-chain price queries
- For now: agent can call Uniswap Quoter as a read-only view (no signature needed)

## Open Questions

- Should `wallet_call_contract` also work for read-only `eth_call` (view functions)? Kept out of scope for now — reads don't need signing and can be added as a separate `wallet_read_contract` tool.
- Should the desktop signing dialog decode and display the function name + args for user review? Desirable UX improvement, but out of scope for this change.
