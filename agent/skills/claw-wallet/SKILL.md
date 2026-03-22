---
name: claw-wallet
description: Manage a Web3 wallet through natural language — check balances, send tokens, manage contacts and security policies. Use when the user asks about their wallet, crypto balances, sending tokens, or managing contacts.
version: 1.0.0
metadata:
  openclaw:
    requires:
      env:
        - RELAY_URL
      bins:
        - node
    primaryEnv: RELAY_URL
    emoji: "🔐"
    homepage: https://github.com/janespace-ai/claw-wallet
---

# Claw Wallet

You have access to Claw Wallet MCP tools for managing an Ethereum/Base wallet. Keys are held securely on a separate Desktop Wallet app — they never touch this agent.

## Available Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `wallet_create` | Create a new wallet (on Desktop Wallet) | — |
| `wallet_import` | Import an existing wallet | — |
| `wallet_pair` | Pair with Desktop Wallet using a short code | `shortCode` (required) |
| `wallet_address` | Get the current wallet address | — |
| `wallet_balance` | Query ETH or ERC-20 token balance | `token` (ETH, USDC, USDT), `chain` (base, ethereum) |
| `wallet_estimate_gas` | Estimate gas cost for a transaction | `to`, `amount`, `chain` |
| `wallet_send` | Send ETH or ERC-20 tokens | `to`, `amount`, `token`, `chain` |
| `wallet_history` | Query transaction history | `limit`, `offset` |
| `wallet_contacts_list` | List saved contacts | — |
| `wallet_contacts_add` | Add or update a contact | `name`, `address`, `chain` |
| `wallet_contacts_resolve` | Look up a contact's address by name | `name`, `chain` |
| `wallet_contacts_remove` | Remove a contact | `name` |
| `wallet_policy_get` | View current security policy | — |
| `wallet_policy_set` | Update spending limits, whitelist, or mode | `per_transaction_limit_usd`, `daily_limit_usd`, `mode`, `add_to_whitelist` |
| `wallet_approval_list` | List pending transaction approvals | — |
| `wallet_approval_approve` | Approve a pending transaction | `id` |
| `wallet_approval_reject` | Reject a pending transaction | `id` |

## Safety Rules

1. **Always confirm before sending**: Ask the user to confirm recipient address and amount before calling `wallet_send`.
2. **Never display secrets**: Do not show private keys, mnemonics, or encrypted credential data under any circumstance.
3. **Verify addresses**: When a user provides an address, confirm it starts with `0x` and is 42 characters. For contacts, use `wallet_contacts_resolve` first.
4. **Check balance before sending**: Before a `wallet_send`, check the balance to ensure sufficient funds.
5. **Respect policy limits**: If a send is blocked by policy, explain the limit to the user and suggest using `wallet_approval_approve` after the Desktop Wallet user approves.

## Common Task Flows

### Check balance
```
wallet_balance → show formatted result
wallet_balance { token: "USDC", chain: "base" } → show token balance
```

### Send to a contact
```
1. wallet_contacts_resolve { name: "bob" }          → get address
2. wallet_balance { token: "ETH" }                   → verify funds
3. wallet_estimate_gas { to: addr, amount: "0.1" }   → show gas cost
4. wallet_send { to: addr, amount: "0.1" }           → confirm + send
```

### Manage security policy
```
wallet_policy_get                                     → show current limits
wallet_policy_set { daily_limit_usd: 500 }           → update limit
wallet_policy_set { add_to_whitelist: "0xABC..." }   → whitelist address
```

### Handle pending approvals
```
wallet_approval_list                                  → show queue
wallet_approval_approve { id: "abc123" }             → approve
wallet_approval_reject { id: "abc123" }              → reject
```

## Error Handling

- "No wallet configured" → Tell user to run `wallet_pair` after creating a wallet in the Desktop App
- "no wallet connected" → Desktop Wallet may be offline; ask user to check it's running
- Transaction blocked → Explain the policy limit and show the approval ID
