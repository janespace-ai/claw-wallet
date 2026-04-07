## Context

**Current Signing Architecture:**

```
Agent
  walletConnection.sendToWallet("sign_transaction", params)
        ↓ relay (E2EE)
  relay-account-channel.ts → handleSignRequest()
        ↓
  signing-engine.ts → signDirectly()
    switch(method):
      "sign_transaction" → wallet.signTransaction(tx)   ✅
      "sign_message"     → wallet.signMessage(msg)      ✅
      anything else      → throw "Unsupported method"   ❌
```

**EIP-712 gap:** `eth_signTypedData_v4` / `sign_typed_data` falls through to the throw. ethers v6's `Wallet.signTypedData(domain, types, value)` is already available — the infrastructure just needs to be wired.

**Key constraint:** `handleSignRequest` in relay-account-channel extracts `to`, `value`, `token`, `chain` from transaction params to build a `TransactionRequestInfo` for the approval dialog and budget check. Typed data has none of these fields — the equivalent context is the EIP-712 `domain` (contract name, version, chainId, verifyingContract).

## Goals / Non-Goals

**Goals:**
- Support `sign_typed_data` as a first-class method in the signing engine
- Route correctly through the existing budget/approval flow
- Show meaningful info in the desktop approval dialog (domain name + message summary)
- Expose `wallet_sign_typed_data` as an agent tool returning the hex signature
- Document Hyperliquid order signing and Permit2 flows in the skill

**Non-Goals:**
- Auto-decode and render typed data fields in the approval dialog (show raw JSON for now)
- EIP-712 domain origin validation against a DApp whitelist
- Batch signing (multiple messages in one request)

## Decisions

### Decision 1: Signing method name — `sign_typed_data`

**Choice:** Use internal method name `sign_typed_data` (not the Ethereum JSON-RPC name `eth_signTypedData_v4`).

**Rationale:** The internal relay protocol uses short verb-style names (`sign_transaction`, `sign_message`). Consistent with existing convention. The agent tool is named `wallet_sign_typed_data`.

### Decision 2: Budget check for typed data — require manual approval

**Choice:** Typed data signing always requires manual user approval unless the domain is in a trusted list (out of scope for this change). No auto-approve.

**Rationale:**
- Typed data can authorize large token transfers (Permit2 can be for unlimited amounts)
- USD value cannot be reliably extracted without knowing the protocol's schema
- Safest default: always prompt, user sees the domain name and raw JSON
- Future: add per-domain auto-approve policy

**Implementation:** In `isWithinBudget()`, return `false` for `sign_typed_data` (forces approval dialog). The approval dialog shows: protocol name (from `domain.name`), `verifyingContract`, `chainId`, and the raw `value` JSON.

### Decision 3: `handleSignRequest` adaptations in relay-account-channel

**Choice:** Extract a `typedDataRequestInfo` branch alongside the existing transaction path.

**Rationale:** The current code extracts `to`, `value`, `token`, `estimatedUSD` from transaction params. For typed data:
- `to` → `domain.verifyingContract` (the contract that will verify the signature)
- `value` → `"0"` (no ETH transfer)
- `token` → `"N/A"`
- `estimatedUSD` → `0`
- `displayLabel` → `domain.name` (e.g. "Hyperliquid" or "Permit2")

This allows the approval dialog to show something meaningful.

### Decision 4: Agent tool interface

```typescript
wallet_sign_typed_data({
  domain: {
    name: string;
    version?: string;
    chainId?: number;
    verifyingContract?: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  value: Record<string, unknown>;  // The actual data to sign
  chain?: string;                   // Chain context (for display)
}): { signature: string }
```

`types` must NOT include the `EIP712Domain` key — ethers.js v6 adds it automatically from `domain`. This matches the Metamask / ethers convention.

### Decision 5: ethers.js signTypedData call

```typescript
// ethers v6
const signature = await wallet.signTypedData(
  params.domain as TypedDataDomain,
  params.types as Record<string, TypedDataField[]>,
  params.value as Record<string, unknown>
);
```

ethers v6 handles the `EIP712Domain` type derivation, hashing, and `v,r,s` encoding automatically. Returns a 65-byte hex signature.

### Decision 6: Sanitization and validation

**Choice:** Validate structure of `domain`, `types`, `value` before signing.

Rules:
- `domain` must be a plain object with at least one field
- `types` must be a Record where each value is an array of `{name: string, type: string}`
- `types` must NOT contain `EIP712Domain` (ethers handles it)
- `value` must be a plain object matching the primary type (best-effort check)
- `domain.chainId` if present must be a positive integer

Malformed input → throw before any signing attempt.

## Implementation Details

### signing-engine.ts changes

```typescript
// In signDirectly(), add case:
if (method === "sign_typed_data") {
  const { domain, types, value } = this.sanitizeTypedDataParams(params);
  const signature = await wallet.signTypedData(domain, types, value);

  this.signingHistory.addRecord({
    requestId: request.requestId,
    type: approved ? "manual" : "auto",
    method: "sign_typed_data",
    to: (domain.verifyingContract as string) ?? "",
    value: "0",
    token: "N/A",
    chain: String(domain.chainId ?? "unknown"),
    estimatedUSD: 0,
    accountIndex: this.accountIndex,
  });

  return { signature, address: wallet.address };
}

// sanitizeTypedDataParams():
private sanitizeTypedDataParams(params: Record<string, unknown>) {
  const domain = params.domain as TypedDataDomain;
  const types = params.types as Record<string, TypedDataField[]>;
  const value = params.value as Record<string, unknown>;
  // Validation checks...
  // Remove EIP712Domain from types if present
  const { EIP712Domain: _, ...cleanTypes } = types as Record<string, TypedDataField[]>;
  return { domain, types: cleanTypes, value };
}
```

### relay-account-channel.ts changes

In `handleSignRequest`, where it currently extracts tx fields:

```typescript
if (method === "sign_typed_data") {
  const domain = (params.domain ?? {}) as Record<string, unknown>;
  requestInfo = {
    to: (domain.verifyingContract as string) ?? "unknown contract",
    value: "0",
    token: "N/A",
    chain: String(domain.chainId ?? chain ?? "unknown"),
    estimatedUSD: 0,
    method: "sign_typed_data",
    displayLabel: (domain.name as string) ?? "Unknown Protocol",
    rawData: JSON.stringify(params.value, null, 2).slice(0, 500), // truncated for display
  };
} else {
  // existing transaction extraction logic
}
```

### agent/src/tools/wallet-sign-typed-data.ts

```typescript
export function createWalletSignTypedDataTool(
  walletConnection: WalletConnection,
  getAddress: () => Address | null,
): ToolDefinition {
  return {
    name: "wallet_sign_typed_data",
    description: `
      Sign EIP-712 typed data messages. Use this for:
      - Hyperliquid order placement and cancellation
      - Permit2 gasless token approvals
      - Off-chain order intents (CoW Protocol, 1inch Fusion)
      - Any protocol requiring eth_signTypedData_v4

      The user will be prompted to confirm in the desktop app before signing.
      Returns a 65-byte hex signature that you send to the protocol's API.

      IMPORTANT: Do NOT include EIP712Domain in the types object.

      Example — Hyperliquid limit order:
        domain: { name: "Exchange", chainId: 42161, verifyingContract: "0x..." }
        types: { Order: [{name: "asset", type: "uint32"}, ...] }
        value: { asset: 0, isBuy: true, ... }
    `,
    parameters: {
      type: "object",
      properties: {
        domain: {
          type: "object",
          description: "EIP-712 domain separator",
          properties: {
            name: { type: "string" },
            version: { type: "string" },
            chainId: { type: "number" },
            verifyingContract: { type: "string" },
          },
        },
        types: {
          type: "object",
          description: "Type definitions (do NOT include EIP712Domain)",
        },
        value: {
          type: "object",
          description: "The data to sign",
        },
        chain: { type: "string", description: "Chain name for context" },
      },
      required: ["domain", "types", "value"],
    },
    execute: async (args) => {
      if (!getAddress()) return { error: "No wallet paired" };
      const result = await walletConnection.sendToWallet("sign_typed_data", {
        domain: args.domain,
        types: args.types,
        value: args.value,
        chain: args.chain,
      });
      return result; // { signature: "0x..." }
    },
  };
}
```

## Skill Update Structure

New section in `skills/claw-wallet/SKILL.md`:

```markdown
## EIP-712 Typed Data Signing

Use `wallet_sign_typed_data` when protocols require signed messages
rather than on-chain transactions — most common in derivatives, gasless
approvals, and off-chain order books.

### Hyperliquid Order Flow
1. Construct order typed data per Hyperliquid SDK schema
2. wallet_sign_typed_data → get signature
3. POST to https://api.hyperliquid.xyz/exchange with the order + signature

### Permit2 Gasless Approval Flow
1. Construct PermitSingle typed data (spender, amount, expiration, nonce)
2. wallet_sign_typed_data → get signature
3. Include signature in the protocol's deposit/swap call

### Known EIP-712 Domains
| Protocol | domain.name | domain.chainId | verifyingContract |
|----------|-------------|----------------|-------------------|
| Hyperliquid (Arbitrum) | "Exchange" | 42161 | 0x... |
| Permit2 (Arbitrum) | "Permit2" | 42161 | 0x000000000022D473030F116dDEE9F6B43aC78BA3 |
| Permit2 (Base) | "Permit2" | 8453 | 0x000000000022D473030F116dDEE9F6B43aC78BA3 |
```

## Risks / Trade-offs

### Risk: Agent signs malicious Permit2 for unlimited amount
**[Risk]** Agent constructs a Permit2 typed data with `amount: MaxUint256` without user realising.

**[Mitigation]**
- Always requires manual approval (Decision 2 — no auto-approve for typed data)
- User sees `domain.name` and raw JSON in approval dialog
- Future: decode and highlight `amount` field in Permit2 types specifically

### Risk: `domain.chainId` mismatch
**[Risk]** Agent constructs typed data for Ethereum but wallet is on Arbitrum.

**[Mitigation]**
- ethers.js does not validate `domain.chainId` against the connected network (it just hashes the domain)
- The signature will be invalid on the wrong chain (contract will reject it)
- No funds at risk — signature is just bytes, not a transaction
- Skill documentation emphasises matching chainId to the protocol's chain

### Risk: types schema injection
**[Risk]** Malformed `types` could cause ethers.js internal errors.

**[Mitigation]**
- `sanitizeTypedDataParams` validates types structure before passing to ethers
- ethers.js itself validates types during `signTypedData`
- Errors surface as clear exceptions, not silent failures

## Open Questions

- Should the desktop approval dialog show a human-readable breakdown of typed data fields (e.g. "Selling 10 USDC for min 0.005 ETH on Uniswap")? This would require protocol-specific decoders. Deferred to a future UX improvement.
- Should `sign_typed_data` requests be recorded in `signing_history`? Yes — added in implementation with `method: "sign_typed_data"` and `estimated_usd: 0`.
