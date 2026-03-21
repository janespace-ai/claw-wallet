## Context

Claw Wallet has 16 tools defined as `ToolDefinition` objects in `agent/tools/`. These tools are instantiated in `agent/index.ts` → `ClawWallet.getTools()` with injected dependencies (ChainAdapter, SignerClient, PolicyEngine, etc.). The tools communicate with the Desktop Wallet via a Relay Server over E2EE WebSocket.

The MCP (Model Context Protocol) ecosystem uses a client-server model: the **host** (OpenClaw Gateway, Claude Desktop, etc.) spawns an MCP server process via stdio and calls tools through JSON-RPC. The server is a long-running process managed by the host.

## Goals / Non-Goals

**Goals:**
- Expose all existing wallet tools as MCP tools with zero code duplication
- Users can start the MCP server with `npx @claw-wallet/mcp-server`
- MCP server handles Relay connection lifecycle, E2EE, and reconnection internally
- Provide OpenClaw skills for tool usage guidance and installation setup
- Shared tool registry between existing agent runtime and MCP server

**Non-Goals:**
- Rewriting tool implementations — MCP server reuses existing code
- HTTP/SSE transport — stdio only (standard for local MCP servers)
- Authentication layer at MCP level — the Desktop Wallet handles approval
- Publishing skills to ClawHub in this change — just create the files

## Decisions

### 1. MCP server as a separate module (`mcp-server/`)

**Decision**: Create a new `mcp-server/` directory at the repo root, with its own `package.json` published as `@claw-wallet/mcp-server`.

**Why not embed in `agent/`**: The agent module is a library for developers building custom runtimes. The MCP server is a standalone executable. Different entry points, different dependencies (`@modelcontextprotocol/sdk`), different packaging concerns.

**Why not a separate repo**: The MCP server directly imports from `agent/` (tool-registry, types). Monorepo keeps them in sync.

### 2. Shared tool registry (`agent/tool-registry.ts`)

**Decision**: Extract tool creation from `ClawWallet.getTools()` into a standalone `createAllTools(deps)` function.

**Why**: Both `ClawWallet` and the MCP server need the same set of tools with the same dependency injection pattern. Duplication would cause drift.

**Interface**:
```typescript
interface ToolDependencies {
  signerClient: SignerClient;
  chainAdapter: ChainAdapter;
  getAddress: () => Address | null;
  getTransferService: () => TransferService | null;
  contacts: ContactsManager;
  policy: PolicyEngine;
  history: TransactionHistory;
  defaultChain: SupportedChain;
}

function createAllTools(deps: ToolDependencies): ToolDefinition[]
```

### 3. ToolDefinition → MCP tool adapter

**Decision**: A generic adapter function maps `ToolDefinition` to MCP `server.tool()` registrations.

```
ToolDefinition.name         → MCP tool name
ToolDefinition.description  → MCP tool description
ToolDefinition.parameters   → MCP inputSchema (JSON Schema)
ToolDefinition.execute()    → MCP tool handler (returns { content: [...] })
```

The adapter wraps execute results into MCP's `{ content: [{ type: "text", text: JSON.stringify(result) }] }` format. Errors are returned as `{ isError: true, content: [...] }`.

### 4. MCP server lifecycle

**Decision**: The MCP server `index.ts` does:
1. Parse environment variables (RELAY_URL, DATA_DIR, DEFAULT_CHAIN)
2. Initialize ClawWallet-like dependencies (ChainAdapter, SignerClient, PolicyEngine, etc.)
3. Register all tools via the adapter
4. Connect to Relay and maintain the connection
5. Serve via `StdioServerTransport`

The host process (OpenClaw Gateway / Claude Desktop) manages spawning and killing.

### 5. OpenClaw skill structure

**Decision**: Two skills, stored in `skills/` at repo root:

| Skill | Purpose |
|-------|---------|
| `skills/claw-wallet/SKILL.md` | Tool usage guide: what each tool does, safety rules, common task flows |
| `skills/claw-wallet-setup/SKILL.md` | Setup guide: how to install MCP server, configure openclaw.json, pair with Desktop Wallet |

**Why two**: Separation of concerns. Setup is done once; usage guidance is always relevant. Users can install both or just the usage skill.

**OpenClaw frontmatter**: Includes `metadata.openclaw.requires.bins: ["node"]` and `metadata.openclaw.requires.env: ["RELAY_URL"]`.

## Risks / Trade-offs

**[Risk] MCP SDK version churn** → Pin `@modelcontextprotocol/sdk` to a specific major version. The stdio transport is stable.

**[Risk] Long-running MCP process disconnects from Relay** → Reuse existing `auto-reconnect` logic from agent module. The MCP server stays alive; only the Relay WebSocket reconnects.

**[Risk] Tool registry refactor breaks existing agent tests** → The refactor is purely mechanical extraction. Run `npm test` in `agent/` before and after.

**[Trade-off] stdio-only transport** → Simplest, most compatible, but limits to local-only use. Remote MCP (HTTP/SSE) can be added later without changing tool logic.

**[Trade-off] Skills are static markdown** → They don't auto-update when tools change. Must be manually updated when adding/removing tools.
