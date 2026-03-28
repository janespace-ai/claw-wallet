## ADDED Requirements

### Requirement: Contact mutations use Relay only

Contact add/remove requests initiated by the Agent SHALL be delivered to the desktop only through the existing Relay encrypted channel by adding new request types or methods. The system SHALL NOT introduce a parallel Agent-to-desktop IPC transport.

#### Scenario: Desktop is authoritative for conflict resolution

- **WHEN** desktop and Agent contact stores disagree for the same logical contact key
- **THEN** the desktop copy SHALL prevail for resolution rules defined in `design.md` of this change

### Requirement: Trusted-address add requires confirmation

Adding a trusted address via an Agent-originated request SHALL require desktop user confirmation. Removing a trusted address MAY proceed without an additional confirmation step beyond desktop UI, as specified in the change design.

#### Scenario: Delete trusted without second Agent confirmation

- **WHEN** a valid desktop-side or Agent-originated delete of a trusted address is processed
- **THEN** the desktop SHALL remove the trust entry without requiring a second Agent-side human approval round-trip
