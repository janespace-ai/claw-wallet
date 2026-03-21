---
name: agent-tool-dev
description: Create or modify Agent tools in agent/tools/. Use when the user wants to add a new wallet tool, extend existing tool capabilities, or asks about the agent tool architecture.
---

# Agent Tool Development

## Architecture

Tools live in `agent/tools/` as TypeScript files. Each file exports a **factory function** that receives dependencies via injection and returns `ToolDefinition` (or `ToolDefinition[]` for related groups).

```typescript
// agent/types.ts
interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}
```

Tools are registered in `agent/index.ts` → `getTools()` method of the `ClawWallet` class.

## Conventions

### Naming
- File: `wallet-<domain>.ts` (e.g., `wallet-balance.ts`)
- Tool name: `wallet_<action>` with underscores (e.g., `wallet_balance`, `wallet_contacts_add`)
- Factory: `createWallet<Domain>Tool` (single) or `createWallet<Domain>Tools` (group returning array)

### Dependencies — Inject, Don't Import Globally
Tools receive their dependencies as factory arguments. Common dependencies:

| Dependency | Type | Purpose |
|---|---|---|
| `chainAdapter` | `ChainAdapter` | On-chain queries (balance, gas, tx) |
| `getAddress` | `() => Address \| null` | Current wallet address (lazy) |
| `defaultChain` | `SupportedChain` | Fallback chain when user omits it |
| `signerClient` | `SignerClient` | IPC to Desktop Wallet for signing/pairing |
| `policy` | `PolicyEngine` | Spending limits and approvals |
| `contacts` | `ContactsManager` | Address book |
| `history` | `TransactionHistory` | Past transactions |
| `getTransferService` | `() => TransferService \| null` | Send tokens (lazy, null before pair) |

### Parameters Schema
Use JSON Schema-style `{ type, properties, required }`. Always include `description` on each property.

### Return Values
- Success: return a data object with a human-friendly `message` field
- Error: return `{ error: "descriptive message" }` — never throw
- Blocked: return `{ blocked: true, reason, approvalId }` for policy-blocked actions

### Guard Checks
- Wallet not configured → `{ error: "No wallet configured. Use wallet_create or wallet_import first." }`
- Relay not connected → `{ error: "..." }`
- Always validate required state before proceeding

## Creating a New Tool — Checklist

1. Create `agent/tools/wallet-<domain>.ts`
2. Import types: `import type { ToolDefinition, SupportedChain } from "../types.js";`
3. Export factory: `export function createWallet<Domain>Tool(...deps): ToolDefinition`
4. Define `name`, `description` (concise, with examples), `parameters`, `execute`
5. Register in `agent/index.ts`:
   - Add import at top
   - Add to `getTools()` return array (spread `...` if returning array)
6. Build: `npm run build` in `agent/`

## Template — Single Tool

```typescript
import type { ToolDefinition, SupportedChain } from "../types.js";

export function createWalletExampleTool(
  dep1: SomeType,
  defaultChain: SupportedChain
): ToolDefinition {
  return {
    name: "wallet_example",
    description: "One-line description with usage example.",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string", description: "What this param does" },
        chain: { type: "string", description: "Chain (base, ethereum)" },
      },
      required: ["param1"],
    },
    execute: async (args) => {
      // Guard: check preconditions
      // Execute logic
      // Return { data..., message: "human summary" }
      // On error: return { error: "message" }
    },
  };
}
```

## Template — Grouped Tools

```typescript
import type { ToolDefinition } from "../types.js";

export function createWalletDomainTools(dep1: SomeType): ToolDefinition[] {
  return [
    {
      name: "wallet_domain_list",
      description: "List items.",
      parameters: { type: "object", properties: {} },
      execute: async () => { /* ... */ },
    },
    {
      name: "wallet_domain_add",
      description: "Add an item.",
      parameters: { /* ... */ },
      execute: async (args) => { /* ... */ },
    },
  ];
}
```

## Existing Tools Reference

| File | Tools | Description |
|---|---|---|
| `wallet-balance.ts` | `wallet_balance`, `wallet_address`, `wallet_estimate_gas` | Query balances, address, gas estimates |
| `wallet-send.ts` | `wallet_send` | Send ETH/ERC-20, handles PolicyBlockedError |
| `wallet-create.ts` | `wallet_create` | Create wallet via Desktop Wallet |
| `wallet-import.ts` | `wallet_import` | Import wallet via Desktop Wallet |
| `wallet-pair.ts` | `wallet_pair` | Pair with Desktop Wallet via short code |
| `wallet-contacts.ts` | `wallet_contacts_list/add/resolve/remove` | Address book CRUD |
| `wallet-policy.ts` | `wallet_policy_get/set` | Security policy management |
| `wallet-approval.ts` | `wallet_approval_list/approve/reject` | Manual approval queue |
| `wallet-history.ts` | `wallet_history` | Transaction history query |
