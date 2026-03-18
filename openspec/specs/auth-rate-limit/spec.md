### Requirement: Failed authentication counting
The Signer SHALL track consecutive failed authentication attempts per session.

#### Scenario: First failed attempt
- **WHEN** a user enters an incorrect password for the first time
- **THEN** the Signer SHALL increment the failure counter to 1 and allow immediate retry

#### Scenario: Successful authentication resets counter
- **WHEN** a user successfully authenticates after previous failures
- **THEN** the Signer SHALL reset the failure counter to 0

### Requirement: Progressive delay enforcement
The Signer SHALL enforce increasing delays after repeated authentication failures.

#### Scenario: Failures 1-3 — no delay
- **WHEN** the failure counter is between 1 and 3
- **THEN** the Signer SHALL allow immediate retry with no additional delay

#### Scenario: Failures 4-5 — short delay
- **WHEN** the failure counter is between 4 and 5
- **THEN** the Signer SHALL enforce a 30-second delay before accepting the next authentication attempt

#### Scenario: Failures 6-10 — medium delay
- **WHEN** the failure counter is between 6 and 10
- **THEN** the Signer SHALL enforce a 5-minute delay before accepting the next authentication attempt

#### Scenario: Failures above 10 — lockout
- **WHEN** the failure counter exceeds 10
- **THEN** the Signer SHALL lock authentication for 1 hour and write a security alert to the audit log

#### Scenario: Request during delay period
- **WHEN** an authentication attempt is made during an active delay period
- **THEN** the Signer SHALL immediately reject with message "Rate limited. Try again in X seconds" without checking the password

### Requirement: Failure count persistence
The Signer SHALL persist the failure counter and lockout state to survive process restarts.

#### Scenario: Signer restarts during lockout
- **WHEN** the Signer is restarted while in a lockout state
- **THEN** the Signer SHALL reload the failure counter and lockout expiry from `rate-limit.json` and continue enforcing the lockout

#### Scenario: Lockout expires after restart
- **WHEN** the Signer is restarted after the lockout period has elapsed
- **THEN** the Signer SHALL reset the failure counter to 0

### Requirement: Rate limit audit logging
The Signer SHALL log rate-limiting events to the audit log.

#### Scenario: Lockout triggered
- **WHEN** the failure counter exceeds 10 and lockout is triggered
- **THEN** the Signer SHALL write an audit entry with type "security_alert", reason "auth_lockout", and the failure count

#### Scenario: Delay enforced
- **WHEN** a delay period is activated (failures 4+)
- **THEN** the Signer SHALL write an audit entry with type "rate_limit", the delay duration, and the failure count
