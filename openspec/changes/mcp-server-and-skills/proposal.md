## Why

Claw Wallet's agent tools currently exist as a TypeScript library (`agent/`) that requires developers to `import` and integrate manually. This limits adoption to developers who build their own agent runtime. The broader AI agent ecosystem (OpenClaw, Claude Desktop, Cursor, VSCode Copilot) has converged on **MCP (Model Context Protocol)** as the standard for tool distribution. By packaging our existing `ToolDefinition`-based tools as an MCP server and providing companion OpenClaw skills, any MCP-compatible AI agent can operate the wallet with zero code integration — just configuration.

## What Changes

- New `mcp-server/` module: a standalone MCP server that wraps existing `agent/tools/` via the MCP stdio transport. Published as `@claw-wallet/mcp-server` on npm. Users start it with `npx @claw-wallet/mcp-server`.
- New `skills/claw-wallet/SKILL.md`: an OpenClaw skill that teaches the agent how to use the wallet tools effectively (scenarios, best practices, safety guidance).
- New `skills/claw-wallet-setup/SKILL.md`: an OpenClaw skill that guides users through configuring `mcpServers` in `openclaw.json` and pairing with the Desktop Wallet.
- Refactor: extract shared tool registration logic from `agent/index.ts` into a reusable `agent/tool-registry.ts` so both the existing agent runtime and the new MCP server share the same tool definitions without duplication.

## Capabilities

### New Capabilities
- `mcp-server`: Standalone MCP server exposing all wallet tools via stdio transport, with lifecycle management (Relay connection, E2EE, reconnection) handled internally
- `openclaw-skill`: OpenClaw SKILL.md that teaches the agent wallet tool usage patterns, safety rules, and common task compositions
- `openclaw-setup-skill`: OpenClaw SKILL.md that guides users through MCP server installation and Desktop Wallet pairing

### Modified Capabilities
- `openclaw-plugin`: Tool registration logic is refactored into a shared registry; the existing OpenClaw plugin spec gains MCP as an alternative integration path

## Impact

- **New module**: `mcp-server/` — new npm package with its own `package.json`, `tsconfig.json`, build scripts
- **Refactored**: `agent/index.ts` — tool creation logic extracted to `agent/tool-registry.ts`
- **New files**: `skills/claw-wallet/SKILL.md`, `skills/claw-wallet-setup/SKILL.md`
- **Dependencies**: `@modelcontextprotocol/sdk` added to `mcp-server/`
- **Distribution**: published to npm as `@claw-wallet/mcp-server`; skills submitted to ClawHub
