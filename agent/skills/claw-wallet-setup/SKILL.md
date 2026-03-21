---
name: claw-wallet-setup
description: Install and configure the Claw Wallet MCP server for OpenClaw. Use when the user wants to set up, install, or configure Claw Wallet, or when wallet tools are not working and need troubleshooting.
version: 1.0.0
metadata:
  openclaw:
    requires:
      bins:
        - node
    emoji: "⚙️"
    homepage: https://github.com/janespace-ai/claw-wallet
---

# Claw Wallet Setup

Guide for installing and configuring the Claw Wallet MCP server.

## Prerequisites

- Node.js 22 or later
- The Claw Wallet Desktop App installed and running
- A running Relay Server (or use the public relay)

## Step 1: Configure MCP Server

Add the following to `~/.openclaw/openclaw.json` in the `mcpServers` section:

```json
{
  "mcpServers": {
    "claw-wallet": {
      "command": "npx",
      "args": ["-y", "@claw-wallet/mcp-server"],
      "transport": "stdio",
      "env": {
        "RELAY_URL": "wss://your-relay-server.example.com",
        "DATA_DIR": "~/.claw-wallet",
        "DEFAULT_CHAIN": "base"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RELAY_URL` | Yes | — | WebSocket URL of the Relay Server |
| `DATA_DIR` | No | `~/.claw-wallet` | Directory for contacts, policy, and history |
| `DEFAULT_CHAIN` | No | `base` | Default blockchain (base or ethereum) |
| `SIGNER_SOCKET` | No | auto-detected | Unix socket path for Desktop Wallet signer |

## Step 2: Restart Gateway

```bash
openclaw gateway restart
```

Verify the MCP server is loaded:
```bash
openclaw mcp list
```
You should see `claw-wallet` in the list.

## Step 3: Pair with Desktop Wallet

1. Open the **Claw Wallet Desktop App**
2. Go to the **Pairing** tab
3. Click **Generate Pairing Code**
4. Tell the agent the code, e.g.: "pair with code ABC123"
5. The agent calls `wallet_pair` to establish the E2EE connection

After pairing, all wallet tools become fully functional.

## Troubleshooting

### "RELAY_URL environment variable is required"
The MCP server cannot start without a relay URL. Add `RELAY_URL` to the `env` section of the `claw-wallet` MCP config.

### "No wallet configured"
The Desktop Wallet has no wallet yet. Ask the user to create one in the Desktop App, or use `wallet_create` / `wallet_import`.

### Tools not appearing
1. Check `openclaw mcp list` — is `claw-wallet` listed?
2. If not, verify the `mcpServers` config in `openclaw.json`
3. Restart the gateway: `openclaw gateway restart`

### Relay connection failures
1. Verify the Relay Server is running and accessible at the configured URL
2. Check for firewall or network issues
3. Try `curl -I https://your-relay-server.example.com` to test connectivity
4. Restart the gateway to force a reconnection

### Desktop Wallet not paired
Run `wallet_pair` with a fresh pairing code from the Desktop App. Codes expire after 5 minutes.
