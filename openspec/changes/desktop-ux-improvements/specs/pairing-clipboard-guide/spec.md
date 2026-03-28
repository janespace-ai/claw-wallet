## ADDED Requirements

### Requirement: Pairing code auto-copy to clipboard
Desktop SHALL automatically copy the pairing code with an Agent-friendly prompt to the system clipboard when the "Generate Pairing Code" button is clicked.

#### Scenario: Successful auto-copy on code generation
- **WHEN** user clicks "Generate Pairing Code" button
- **THEN** system generates a pairing code AND copies a formatted prompt to clipboard

### Requirement: Agent-recognizable prompt format
The clipboard content SHALL include an English prompt that enables the Agent to automatically recognize and use the pairing code via the `wallet_pair` tool.

#### Scenario: Prompt contains code and instruction
- **WHEN** pairing code is "BZJBWD55"
- **THEN** clipboard contains: "My Claw Wallet pairing code is: BZJBWD55\nPlease pair with it using wallet_pair tool."

### Requirement: User feedback on copy success
Desktop SHALL display visual feedback confirming the pairing code was copied to clipboard.

#### Scenario: Copy success notification
- **WHEN** pairing code is successfully copied
- **THEN** system displays "Copied to clipboard!" message near the pairing code
