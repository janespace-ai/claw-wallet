## ADDED Requirements

### Requirement: Password minimum length
The password strength validator SHALL reject any password shorter than 12 characters.

#### Scenario: Password meets minimum length
- **WHEN** a password of 12 or more characters is provided
- **THEN** the validator SHALL pass the length check

#### Scenario: Password too short
- **WHEN** a password shorter than 12 characters is provided
- **THEN** the validator SHALL reject it with message "Password must be at least 12 characters"

### Requirement: Password character complexity
The password strength validator SHALL require at least one character from each of four categories: uppercase letter, lowercase letter, digit, and special character.

#### Scenario: Password meets all complexity requirements
- **WHEN** a password contains at least one uppercase letter, one lowercase letter, one digit, and one special character
- **THEN** the validator SHALL pass the complexity check

#### Scenario: Password missing uppercase
- **WHEN** a password contains no uppercase letter
- **THEN** the validator SHALL reject it with a message indicating the missing category

#### Scenario: Password missing special character
- **WHEN** a password contains no special character (e.g., !@#$%^&*()_+-=[]{}|;:,.<>?)
- **THEN** the validator SHALL reject it with a message indicating the missing category

### Requirement: Weak password dictionary
The password strength validator SHALL reject passwords found in a built-in dictionary of common weak passwords.

#### Scenario: Common weak password rejected
- **WHEN** a password matches an entry in the top-10000 weak password dictionary (case-insensitive comparison)
- **THEN** the validator SHALL reject it with message "Password is too common"

#### Scenario: Dictionary check is case-insensitive
- **WHEN** a password matches a dictionary entry but with different casing (e.g., "Password123!" matching "password123!")
- **THEN** the validator SHALL still reject it

#### Scenario: Strong password passes dictionary check
- **WHEN** a password is not found in the dictionary
- **THEN** the validator SHALL pass the dictionary check

### Requirement: Password confirmation on creation
The Signer SHALL require the user to enter the password twice when creating or importing a wallet.

#### Scenario: Passwords match
- **WHEN** the user enters the same password twice during wallet creation
- **THEN** the Signer SHALL accept the password and proceed

#### Scenario: Passwords do not match
- **WHEN** the user enters different passwords on first and second entry
- **THEN** the Signer SHALL reject with message "Passwords do not match" and prompt again (up to 3 retries)

#### Scenario: Maximum retries exceeded
- **WHEN** the user fails to match passwords 3 times
- **THEN** the Signer SHALL abort the operation and return an error
