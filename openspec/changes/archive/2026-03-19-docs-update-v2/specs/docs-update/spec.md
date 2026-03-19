## ADDED Requirements

### Requirement: Documentation reflects Phase 2 three-component architecture
All README files and supplementary documentation SHALL accurately describe the current three-component architecture (Agent + Desktop Wallet + Go Relay Server), E2EE communication, automatic pairing/reconnection, three-level verification, and Relay-side protections.

#### Scenario: New user reads README
- **WHEN** a new user opens README.md
- **THEN** the document presents user interaction flow before technical details, highlights security architecture as a core section, and accurately describes the three-component system

#### Scenario: User reads security model section
- **WHEN** a user reads the security model section of any README
- **THEN** the document covers communication security (E2EE, auto-pairing, three-level verification, Relay protection) and key security (Keystore V3, memory safety, policy engine)

#### Scenario: All language versions are consistent
- **WHEN** a user reads any of the 9 language versions of README
- **THEN** the content structure and technical accuracy are consistent across all versions
