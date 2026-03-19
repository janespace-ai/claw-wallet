## ADDED Requirements

### Requirement: Platform biometric authentication
The Electron App SHALL support platform-specific biometric authentication for unlocking the wallet after initial password setup.

#### Scenario: macOS Touch ID unlock
- **WHEN** the App launches on macOS with Touch ID hardware available and biometric unlock enabled
- **THEN** the App SHALL prompt for Touch ID using `systemPreferences.promptTouchID()` and upon success, retrieve the cached derived key from macOS Keychain

#### Scenario: Windows Hello unlock
- **WHEN** the App launches on Windows with Windows Hello configured and biometric unlock enabled
- **THEN** the App SHALL prompt for Windows Hello authentication and upon success, retrieve the cached derived key from Credential Locker

#### Scenario: Linux password fallback
- **WHEN** the App launches on Linux
- **THEN** the App SHALL prompt for password entry (no biometric support) and derive the key from the entered password

#### Scenario: Biometric failure fallback
- **WHEN** biometric authentication fails or is cancelled by the user
- **THEN** the App SHALL fall back to password entry

### Requirement: OS secure storage for derived key
The Electron App SHALL cache the password-derived encryption key in the OS secure storage, protected by biometric or system authentication.

#### Scenario: First launch — password required
- **WHEN** the App launches for the first time (or after OS secure storage is cleared)
- **THEN** the App SHALL require password entry, derive the encryption key via Scrypt, decrypt the wallet, and offer to store the derived key in OS secure storage with biometric protection

#### Scenario: Subsequent launch — biometric retrieval
- **WHEN** the App launches and a derived key exists in OS secure storage
- **THEN** the App SHALL use biometric/system authentication to retrieve the key and decrypt the wallet without requiring password entry

#### Scenario: OS secure storage access control
- **WHEN** the derived key is stored in OS secure storage
- **THEN** it SHALL be configured with access control requiring user presence (macOS: kSecAccessControlBiometryCurrentSet; Windows: Windows Hello verification) and SHALL NOT be accessible to other processes without user authentication

#### Scenario: Enable or disable biometric
- **WHEN** user toggles biometric unlock in settings
- **THEN** enabling SHALL store the derived key in OS secure storage (after biometric verification); disabling SHALL remove the key from OS secure storage

### Requirement: Biometric confirmation for sensitive operations
Sensitive operations beyond wallet unlock SHALL also require biometric or password confirmation.

#### Scenario: Pairing requires authentication
- **WHEN** a new Agent requests to pair with the Electron App
- **THEN** the App SHALL require biometric or password confirmation before accepting the pairing

#### Scenario: Allowance change requires authentication
- **WHEN** user modifies the allowance budget settings
- **THEN** the App SHALL require biometric or password confirmation before saving changes

#### Scenario: Mnemonic export requires password
- **WHEN** user requests to view the mnemonic backup phrase
- **THEN** the App SHALL require password entry (NOT biometric) as biometric cannot protect against shoulder-surfing for the displayed mnemonic
