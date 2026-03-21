## ADDED Requirements

### Requirement: Skill file structure
The skill SHALL be a valid OpenClaw skill with YAML frontmatter containing `name`, `description`, and `metadata.openclaw` fields.

#### Scenario: OpenClaw loads the skill
- **WHEN** the skill is placed in `~/.openclaw/workspace/skills/claw-wallet/`
- **THEN** OpenClaw SHALL recognize it as a valid skill and make its guidance available to the agent

### Requirement: Tool usage documentation
The skill SHALL document all wallet tools with descriptions, parameter details, and usage examples.

#### Scenario: Agent understands tool purpose
- **WHEN** a user asks "what can you do with my wallet?"
- **THEN** the agent SHALL reference the skill to list available capabilities (balance, send, contacts, policy, history, pairing)

#### Scenario: Agent selects correct tool
- **WHEN** a user says "check how much USDC I have on Base"
- **THEN** the agent SHALL use the skill guidance to call `wallet_balance` with `{ token: "USDC", chain: "base" }`

### Requirement: Safety rules
The skill SHALL include explicit safety rules for financial operations.

#### Scenario: Large transfer warning
- **WHEN** the skill is loaded
- **THEN** it SHALL instruct the agent to confirm with the user before sending transactions above the policy per-transaction limit

#### Scenario: Never expose secrets
- **WHEN** the skill is loaded
- **THEN** it SHALL instruct the agent to never display private keys, mnemonics, or encrypted credential data

### Requirement: Common task flows
The skill SHALL document multi-step task compositions.

#### Scenario: Send to contact flow
- **WHEN** the skill is loaded
- **THEN** it SHALL describe the flow: resolve contact → check balance → estimate gas → send → confirm hash
