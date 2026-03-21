## 1. Shared Tool Registry

- [x] 1.1 Create `agent/tool-registry.ts`：export `ToolDependencies` interface and `createAllTools(deps): ToolDefinition[]` function, extracting tool creation logic from `ClawWallet.getTools()`
- [x] 1.2 Refactor `agent/index.ts` `getTools()` to call `createAllTools()` instead of inline tool creation, keeping the `reloadAddress` wrappers in `ClawWallet`
- [x] 1.3 Run `npm test` in `agent/` to verify no regressions

## 2. MCP Server Module Setup

- [x] 2.1 Create `mcp-server/` directory with `package.json` (name: `@claw-wallet/mcp-server`, bin entry pointing to `dist/index.js`), `tsconfig.json`
- [x] 2.2 Add `@modelcontextprotocol/sdk` dependency and configure TypeScript to compile ESM output
- [x] 2.3 Create `mcp-server/src/adapter.ts`：generic `registerTools(server, tools: ToolDefinition[])` function that maps each `ToolDefinition` to `server.tool()` with inputSchema and execute handler, wrapping results into MCP content format

## 3. MCP Server Core

- [x] 3.1 Create `mcp-server/src/index.ts`：parse env vars (`RELAY_URL` required, `DATA_DIR` optional defaults to `~/.claw-wallet/`, `DEFAULT_CHAIN` optional), exit with error if `RELAY_URL` missing
- [x] 3.2 Initialize dependencies: `ChainAdapter`, `SignerClient`, `ContactsManager`, `PolicyEngine`, `TransactionHistory`, using config from env vars
- [x] 3.3 Call `createAllTools(deps)` from shared registry + `registerTools(server, tools)` from adapter
- [x] 3.4 Create `StdioServerTransport`, connect to MCP server, connect to Relay Server
- [x] 3.5 Add SIGTERM/SIGINT handler for graceful shutdown (disconnect Relay, close MCP transport)
- [x] 3.6 Add `#!/usr/bin/env node` shebang to compiled output, verify `npx .` works locally

## 4. MCP Server Build & Test

- [x] 4.1 Add build script to `mcp-server/package.json`, verify `npm run build` compiles successfully
- [x] 4.2 Write basic test: mock `StdioServerTransport`, call `tools/list`, verify all 17 tool names present
- [x] 4.3 Write adapter test: create a dummy `ToolDefinition`, register via adapter, call it, verify MCP response format (`content[0].type === "text"`)
- [x] 4.4 Write error test: `ToolDefinition` returning `{ error: "..." }` produces `isError: true` MCP response

## 5. OpenClaw Usage Skill

- [x] 5.1 Create `skills/claw-wallet/SKILL.md` with OpenClaw frontmatter: `name: claw-wallet`, `description`, `metadata.openclaw.requires.env: ["RELAY_URL"]`, `metadata.openclaw.requires.bins: ["node"]`, `metadata.openclaw.emoji: "🦞"`
- [x] 5.2 Write tool reference section: table of all 17 tools with name, one-line description, key parameters
- [x] 5.3 Write safety rules section: confirm large sends, never show secrets, verify addresses
- [x] 5.4 Write common task flows: check balance, send to contact, manage policy, approve pending tx

## 6. OpenClaw Setup Skill

- [x] 6.1 Create `skills/claw-wallet-setup/SKILL.md` with OpenClaw frontmatter: `name: claw-wallet-setup`, `description` including "install", "configure", "setup"
- [x] 6.2 Write MCP server configuration section: exact JSON to add to `mcpServers` in `openclaw.json`, env var list
- [x] 6.3 Write pairing guide: step-by-step flow (start Desktop Wallet → generate code → `wallet_pair`)
- [x] 6.4 Write troubleshooting section: Relay connection failure, "No wallet configured" error, gateway restart

## 7. Integration & Validation

- [x] 7.1 `npm run build` in `agent/` passes
- [x] 7.2 `npm run build` in `mcp-server/` passes
- [x] 7.3 `npm test` in `agent/` passes (no regression from tool-registry refactor)
- [x] 7.4 `npm test` in `mcp-server/` passes
- [x] 7.5 Manual verify: `npx .` in `mcp-server/` starts and responds to MCP initialize handshake
