## MODIFIED Requirements

### Requirement: IP change detection
The Electron App SHALL monitor the source IP of incoming messages (as reported by the Relay) and enforce configurable policy actions on change.

#### Scenario: IP unchanged
- **WHEN** a signing request arrives and the source IP matches the last known IP for this paired Agent
- **THEN** the request SHALL proceed through the normal authorization flow (allowance check or confirmation)

#### Scenario: IP changed — warn policy (default)
- **WHEN** a signing request arrives with a different source IP and the IP change policy is `"warn"`
- **THEN** the Electron App SHALL display a security alert, require user confirmation for the current and next transaction, and update the stored IP after user acknowledges

#### Scenario: IP changed — block policy
- **WHEN** a signing request arrives with a different source IP and the IP change policy is `"block"`
- **THEN** the Electron App SHALL freeze the session and require manual re-pairing

#### Scenario: IP changed — allow policy
- **WHEN** a signing request arrives with a different source IP and the IP change policy is `"allow"`
- **THEN** the Electron App SHALL silently update the lastIP and proceed normally

#### Scenario: IP change policy configuration
- **WHEN** the user opens security settings
- **THEN** the App SHALL allow setting the IP change policy to one of: `"block"`, `"warn"` (default), or `"allow"`

### Requirement: Device fingerprint binding
The Electron App SHALL bind the pairing to a device fingerprint reported by the Agent and enforce identity on every reconnection.

#### Scenario: Fingerprint recorded during pairing
- **WHEN** pairing completes successfully
- **THEN** the Electron App SHALL record the Agent's machineId (hash of hostname + primary MAC address) as the bound device fingerprint

#### Scenario: Fingerprint verified on reconnection
- **WHEN** a reconnection handshake is received with machineId
- **THEN** the Electron App SHALL compare the received machineId against the stored fingerprint

#### Scenario: Fingerprint mismatch enforced
- **WHEN** a reconnection handshake arrives with a machineId different from the stored fingerprint
- **THEN** the Electron App SHALL reject the connection, freeze the session, log a `device_mismatch` security event, and require manual re-pairing
