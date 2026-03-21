## ADDED Requirements

### Requirement: MCP stdio transport
The MCP server SHALL communicate with hosts via JSON-RPC over stdin/stdout (stdio transport) as defined by the Model Context Protocol specification.

#### Scenario: Host spawns MCP server
- **WHEN** a host (OpenClaw Gateway, Claude Desktop) spawns the MCP server process
- **THEN** the server SHALL respond to the MCP `initialize` handshake over stdio
- **AND** the server SHALL advertise all wallet tools in its `tools/list` response

### Requirement: Tool exposure via MCP
The MCP server SHALL expose all 16 wallet tools as MCP tools with correct name, description, and inputSchema derived from existing `ToolDefinition` objects.

#### Scenario: Tool list matches agent tools
- **WHEN** a host calls `tools/list`
- **THEN** the response SHALL contain exactly the same tool names as `ClawWallet.getTools()`: `wallet_create`, `wallet_import`, `wallet_pair`, `wallet_address`, `wallet_balance`, `wallet_estimate_gas`, `wallet_send`, `wallet_contacts_list`, `wallet_contacts_add`, `wallet_contacts_resolve`, `wallet_contacts_remove`, `wallet_policy_get`, `wallet_policy_set`, `wallet_approval_list`, `wallet_approval_approve`, `wallet_approval_reject`, `wallet_history`

#### Scenario: Tool call returns structured result
- **WHEN** a host calls `tools/call` with `{ name: "wallet_balance", arguments: { token: "ETH" } }`
- **THEN** the server SHALL return `{ content: [{ type: "text", text: "<JSON result>" }] }`

#### Scenario: Tool call error
- **WHEN** a tool's `execute()` returns an `{ error: "..." }` object
- **THEN** the MCP response SHALL set `isError: true` and include the error message in content

### Requirement: Relay connection lifecycle
The MCP server SHALL connect to the Relay Server on startup and maintain the connection for the lifetime of the process.

#### Scenario: Startup connection
- **WHEN** the MCP server process starts
- **THEN** it SHALL connect to the Relay Server URL specified by the `RELAY_URL` environment variable
- **AND** it SHALL initialize the E2EE transport layer

#### Scenario: Reconnection on disconnect
- **WHEN** the Relay WebSocket connection drops
- **THEN** the MCP server SHALL automatically reconnect using exponential backoff
- **AND** existing MCP tool calls SHALL return an error "Relay disconnected, reconnecting..." until reconnected

#### Scenario: Graceful shutdown
- **WHEN** the MCP server process receives SIGTERM or the host closes stdio
- **THEN** it SHALL disconnect from the Relay, flush pending state, and exit cleanly

### Requirement: Environment variable configuration
The MCP server SHALL be configurable via environment variables.

#### Scenario: Required RELAY_URL
- **WHEN** `RELAY_URL` is not set
- **THEN** the server SHALL exit with error code 1 and message "RELAY_URL environment variable is required"

#### Scenario: Optional DATA_DIR
- **WHEN** `DATA_DIR` is set
- **THEN** the server SHALL use that path for contacts, policy, and history storage
- **WHEN** `DATA_DIR` is not set
- **THEN** the server SHALL default to `~/.claw-wallet/`

#### Scenario: Optional DEFAULT_CHAIN
- **WHEN** `DEFAULT_CHAIN` is set to "ethereum" or "base"
- **THEN** the server SHALL use that as the default chain for tools that accept a chain parameter

### Requirement: npx executable
The npm package SHALL be executable via `npx @claw-wallet/mcp-server`.

#### Scenario: npx invocation
- **WHEN** a user runs `npx @claw-wallet/mcp-server`
- **THEN** the MCP server process SHALL start and begin listening on stdio
