## ADDED Requirements

### Requirement: Password-confirmed account deregistration
The system SHALL allow a user to permanently delete all wallet data from the current device by entering their wallet password in a confirmation modal. Deletion SHALL only proceed when the password is correct.

#### Scenario: Correct password triggers full data wipe
- **WHEN** the user enters the correct wallet password and taps "永久注销"
- **THEN** the system SHALL delete all files under `{userData}/wallet-data/`, reinitialize `KeyManager` to a no-wallet state, and navigate the renderer to the welcome/setup screen

#### Scenario: Wrong password is rejected without deletion
- **WHEN** the user enters an incorrect password and taps "永久注销"
- **THEN** the system SHALL display an inline error message and SHALL NOT delete any data

#### Scenario: Empty password is ignored
- **WHEN** the user taps "永久注销" with an empty password field
- **THEN** the system SHALL take no action (no IPC call, no error displayed)

#### Scenario: Cancel dismisses the modal without deletion
- **WHEN** the user taps "取消" in the deregister confirmation modal
- **THEN** the modal SHALL close and no data SHALL be deleted

### Requirement: Danger warning in Settings before deregister row
The system SHALL display a light-red warning card above the "注销账户" row in Settings, containing a danger icon, "危险操作" title, and a reminder to back up the mnemonic phrase before proceeding.

#### Scenario: Warning card is always visible in Settings
- **WHEN** the user opens the Settings tab
- **THEN** the "账户" section SHALL be visible at the bottom with the red warning card above the "注销账户" row

### Requirement: Post-deregistration state
After successful deregistration the system SHALL be in a state equivalent to a fresh install on this device — `hasWallet()` returns false and the app shows the welcome/setup screen.

#### Scenario: App shows welcome screen after deregister
- **WHEN** deregistration succeeds
- **THEN** the renderer SHALL call `showScreen("setup")` and the tab bar and main content SHALL not be visible

#### Scenario: Relay is shut down before deletion
- **WHEN** deregistration is triggered
- **THEN** the Relay bridge SHALL be shut down and the wallet SHALL be locked before any files are deleted
