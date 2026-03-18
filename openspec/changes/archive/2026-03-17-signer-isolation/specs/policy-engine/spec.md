## MODIFIED Requirements

### Requirement: Approval queue
The system SHALL maintain a queue of transactions pending manual approval. The Signer process SHALL handle its own authorization (Allowance-based), while the application-layer Policy Engine continues to enforce spending limits and whitelist rules.

#### Scenario: Approve pending transaction
- **WHEN** user invokes `wallet_approval_approve` with a transaction ID
- **THEN** the system retrieves the queued transaction, sends it to the Signer for signing (which may auto-sign if within Allowance, or prompt user), broadcasts, and returns the result

## ADDED Requirements

### Requirement: Dual-layer policy enforcement
The system SHALL enforce policies at two independent layers: the application-layer Policy Engine (in the Tool process) and the Signer-layer Allowance (in the Signer process).

#### Scenario: Both layers must pass
- **WHEN** a transaction is submitted
- **THEN** it SHALL first pass the application-layer Policy Engine checks (per-tx limit, daily limit, whitelist), and then the Signer SHALL independently evaluate its Allowance policy before signing

#### Scenario: Application layer blocks, Signer not reached
- **WHEN** the application-layer Policy Engine blocks a transaction (e.g., exceeds daily limit)
- **THEN** the transaction SHALL be queued for approval in the Policy Engine without ever reaching the Signer

#### Scenario: Application layer passes, Signer blocks
- **WHEN** the application-layer Policy Engine approves a transaction but the Signer's Allowance policy rejects it (e.g., unknown recipient)
- **THEN** the Signer SHALL prompt the user for confirmation, and if the user rejects, the Tool SHALL return a "user rejected" error
