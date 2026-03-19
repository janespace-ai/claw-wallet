## MODIFIED Requirements

### Requirement: AuthProvider interface
The Signer SHALL no longer directly interact with users through a local AuthProvider. User authentication and transaction confirmation SHALL be handled by the Electron Wallet App. The Signer SHALL forward requests through the E2EE relay channel.

#### Scenario: Signing confirmation
- **WHEN** a transaction requires user confirmation
- **THEN** the Signer SHALL forward the transaction details to the Electron App via E2EE channel, and the Electron App SHALL handle the user interaction (biometric, password, or dialog)

#### Scenario: No local AuthProvider needed
- **WHEN** the Signer starts in relay mode
- **THEN** the Signer SHALL NOT require --auth-type argument, as authentication is handled by the remote Electron App

### Requirement: Three-level authorization model
The three-level authorization model SHALL be enforced by the Electron Wallet App instead of the Signer. The Signer SHALL forward all signing requests to the Electron App, which SHALL apply the authorization rules locally.

#### Scenario: Level 0 auto-sign within allowance
- **WHEN** a sign_transaction request is forwarded to the Electron App and matches the current AllowancePolicy
- **THEN** the Electron App SHALL sign the transaction automatically without user interaction and return the signed transaction

#### Scenario: Level 1 quick confirmation
- **WHEN** a sign_transaction request exceeds the allowance but is within a reasonable range
- **THEN** the Electron App SHALL prompt the user for confirmation via its UI

#### Scenario: Level 2 full approval
- **WHEN** a sign_transaction request is for a large amount or targets an unknown recipient
- **THEN** the Electron App SHALL prompt the user for full approval with password entry via its UI

## REMOVED Requirements

### Requirement: Transaction context display
**Reason**: Transaction context display is now handled by the Electron App UI, not the Signer AuthProvider.
**Migration**: The Electron App displays transaction details in its own confirmation dialog.

### Requirement: Signing audit log
**Reason**: Audit logging is now handled by the Electron App which has full visibility into all signing decisions.
**Migration**: The Electron App maintains its own audit log with richer context including IP monitoring data.
