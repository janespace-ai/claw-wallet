## MODIFIED Requirements

### Requirement: Single SQLite model for contacts with trusted flag

The Desktop wallet SHALL store authoritative contacts in one table that includes a per-row **`trusted`** flag (trusted contact eligible for silent signing within allowance). The separate `trusted_addresses` table SHALL be removed after migration. **Each logical display name SHALL map to at most one row, and each `(address, chain)` pair to at most one row**, enforced by schema or equivalent constraints after migration.

#### Scenario: Trusted row participates in address gate

- **WHEN** the signing policy requires a trusted recipient for silent sign AND the transaction counterparty address matches a row in the contacts table for the same logical chain with `trusted` true
- **THEN** the address gate for silent signing SHALL pass (subject to USD and token limits)

#### Scenario: Untrusted row does not grant silent sign by address

- **WHEN** the counterparty matches a contact with `trusted` false only
- **THEN** the address gate SHALL treat the recipient as not trusted for silent signing

#### Scenario: No ambiguous reverse lookup by address

- **WHEN** the wallet resolves a counterparty address and chain against the contact table for UI labeling
- **THEN** at most one matching name MAY exist for that `(address, chain)` pair
