## ADDED Requirements

### Requirement: IP change detection
The Electron App SHALL monitor the source IP of incoming messages (as reported by the Relay) and detect changes from the established baseline.

#### Scenario: IP unchanged
- **WHEN** a signing request arrives and the source IP matches the last known IP for this paired Agent
- **THEN** the request SHALL proceed through the normal authorization flow (allowance check or confirmation)

#### Scenario: IP changed
- **WHEN** a signing request arrives and the source IP differs from the last known IP
- **THEN** the Electron App SHALL immediately downgrade to Level 2 authorization (require user confirmation for ALL transactions regardless of amount) and display a security alert showing the old and new IP addresses

#### Scenario: IP change response options
- **WHEN** an IP change alert is displayed
- **THEN** the user SHALL be presented with three options: Reject and freeze (block all signing for 30 minutes), Allow this once (sign this transaction but continue requiring confirmation), Trust new device (update the trusted IP binding)

### Requirement: Device fingerprint binding
The Electron App SHALL bind the pairing to a device fingerprint reported by the Agent during pairing.

#### Scenario: Fingerprint recorded during pairing
- **WHEN** pairing completes successfully
- **THEN** the Electron App SHALL record the Agent's device fingerprint (hash of hostname, OS info, network interface identifiers) alongside the trusted IP

#### Scenario: Fingerprint mismatch
- **WHEN** a signing request arrives with a device fingerprint different from the one recorded during pairing
- **THEN** the Electron App SHALL treat it as a potential impersonation, downgrade to Level 2 authorization, and display a security alert

### Requirement: Freeze mode
The Electron App SHALL support a freeze mode that blocks all signing operations for a configurable duration.

#### Scenario: User triggers freeze
- **WHEN** user selects Reject and freeze on a security alert or manually activates freeze mode
- **THEN** the Electron App SHALL reject all signing requests for 30 minutes (configurable) and display a countdown timer

#### Scenario: Freeze expires
- **WHEN** the freeze duration expires
- **THEN** the Electron App SHALL resume normal operation but SHALL require user confirmation for the next transaction (one-time extra verification)

### Requirement: Same-machine detection
The system SHALL detect when the Electron App and the paired Agent are running on the same physical machine.

#### Scenario: machineId comparison during pairing
- **WHEN** pairing handshake includes machineId from both sides
- **THEN** the system SHALL compare the machineIds (hash of hostname plus primary MAC address) and flag same-machine pairing

#### Scenario: Same-machine persistent warning
- **WHEN** a same-machine pairing is active
- **THEN** the Electron App SHALL display a persistent red warning badge in the UI and SHALL re-display the full warning on each App launch

### Requirement: Security event audit log
The Electron App SHALL maintain a local audit log of all security-relevant events.

#### Scenario: IP change logged
- **WHEN** an IP change is detected
- **THEN** the App SHALL log: timestamp, old IP, new IP, user response (freeze/allow/trust)

#### Scenario: Device fingerprint mismatch logged
- **WHEN** a device fingerprint mismatch is detected
- **THEN** the App SHALL log: timestamp, expected fingerprint, received fingerprint, user response

#### Scenario: Signing event logged
- **WHEN** a transaction is signed (auto or confirmed)
- **THEN** the App SHALL log: timestamp, recipient, amount, token, authorization level, source IP
