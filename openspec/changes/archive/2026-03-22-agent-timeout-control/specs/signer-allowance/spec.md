## MODIFIED Requirements

### Requirement: Pending approval auto-expiration
The `SigningEngine` SHALL automatically reject any pending sign request that has not been approved or rejected within 10 minutes. When auto-expiry fires, the pending promise SHALL be rejected with Error "Approval timeout: transaction expired after 10 minutes", the request SHALL be removed from `pendingRequests`, and the UI SHALL be notified to dismiss the approval prompt.

#### Scenario: User does not respond within 10 minutes
- **WHEN** a `sign_transaction` request exceeds budget and enters pending state
- **AND** 10 minutes elapse without user approving or rejecting
- **THEN** the pending promise rejects with Error "Approval timeout: transaction expired after 10 minutes"
- **AND** the request is removed from `pendingRequests`

#### Scenario: User approves before timeout
- **WHEN** a `sign_transaction` request enters pending state
- **AND** user clicks approve within 10 minutes
- **THEN** the request is signed normally and the expiry timer is cancelled

#### Scenario: User rejects before timeout
- **WHEN** a `sign_transaction` request enters pending state
- **AND** user clicks reject within 10 minutes
- **THEN** the pending promise rejects with "Transaction rejected by user" and the expiry timer is cancelled

### Requirement: Structured error responses
When `relay-bridge` sends an error response back to the Agent, it SHALL include a structured `errorCode` field alongside the `error` message string. Defined error codes:

| errorCode | Meaning |
|-----------|---------|
| `WALLET_LOCKED` | Wallet is locked, needs unlock |
| `SESSION_FROZEN` | Session frozen due to security policy |
| `APPROVAL_TIMEOUT` | User did not approve in time |
| `USER_REJECTED` | User explicitly rejected |
| `SIGN_ERROR` | Signing failed (key issue, method unsupported) |

#### Scenario: Wallet locked error
- **WHEN** Agent sends a sign request and Desktop Wallet is locked
- **THEN** Agent receives `{"requestId":"r1","error":"Wallet is locked...","errorCode":"WALLET_LOCKED"}`

#### Scenario: Approval timeout error
- **WHEN** pending approval expires after 10 minutes
- **THEN** Agent receives `{"requestId":"r1","error":"Approval timeout...","errorCode":"APPROVAL_TIMEOUT"}`
