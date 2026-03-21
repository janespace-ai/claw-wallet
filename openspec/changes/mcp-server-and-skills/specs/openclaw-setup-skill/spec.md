## ADDED Requirements

### Requirement: Setup skill file structure
The setup skill SHALL be a valid OpenClaw skill with YAML frontmatter and `metadata.openclaw.requires.bins: ["node"]`.

#### Scenario: OpenClaw loads the setup skill
- **WHEN** the skill is placed in `~/.openclaw/workspace/skills/claw-wallet-setup/`
- **THEN** OpenClaw SHALL recognize it as a valid skill

### Requirement: MCP server installation guide
The skill SHALL instruct the agent how to configure the MCP server in `openclaw.json`.

#### Scenario: Agent configures mcpServers
- **WHEN** a user says "set up Claw Wallet"
- **THEN** the agent SHALL follow the skill to add the `claw-wallet` entry to `mcpServers` in `~/.openclaw/openclaw.json` with the correct `command`, `args`, `transport`, and `env` fields

### Requirement: Desktop Wallet pairing guide
The skill SHALL document the pairing flow between MCP server and Desktop Wallet.

#### Scenario: Agent guides pairing
- **WHEN** the MCP server is configured and the user wants to pair
- **THEN** the agent SHALL instruct the user to open the Desktop Wallet, generate a pairing code, and then call `wallet_pair` with that code

### Requirement: Troubleshooting guide
The skill SHALL include common troubleshooting steps.

#### Scenario: Relay connection failure
- **WHEN** the user reports wallet tools are not working
- **THEN** the agent SHALL follow the skill to check RELAY_URL, verify the Relay Server is running, and suggest `openclaw gateway restart`
