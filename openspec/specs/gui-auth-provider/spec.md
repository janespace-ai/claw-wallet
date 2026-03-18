### Requirement: GUI password dialog via localhost HTTP
The GuiAuthProvider SHALL launch a temporary HTTP server on `127.0.0.1` with a random port and open the system default browser to display password input dialogs.

#### Scenario: Password input dialog
- **WHEN** `requestPin` is called on `GuiAuthProvider`
- **THEN** the provider SHALL start an HTTP server on `127.0.0.1:{random_port}`, generate a one-time token, open `http://127.0.0.1:{port}/dialog?token={uuid}` in the system browser, and wait for the user to submit the password via POST

#### Scenario: Password creation dialog with confirmation
- **WHEN** `requestPasswordWithConfirmation` is called on `GuiAuthProvider`
- **THEN** the provider SHALL display a page with two password fields, a real-time password strength indicator, and validation feedback; the page SHALL reject submission until both fields match and strength requirements are met

#### Scenario: One-time token security
- **WHEN** a request arrives at the HTTP server
- **THEN** the server SHALL verify the token matches the generated UUID; a mismatched or missing token SHALL return HTTP 403; a used token SHALL NOT be accepted again

#### Scenario: Server lifecycle
- **WHEN** a valid password submission is received or timeout occurs
- **THEN** the HTTP server SHALL immediately close and release the port

### Requirement: GUI transaction confirmation dialog
The GuiAuthProvider SHALL display transaction details in a browser-based confirmation page for Level 1 and Level 2 operations.

#### Scenario: Level 1 quick confirmation
- **WHEN** `requestConfirm` is called with a `send` operation context
- **THEN** the provider SHALL display a page showing recipient address, amount, token symbol, chain name, and two buttons: "Reject" and "Confirm"

#### Scenario: Level 2 password confirmation
- **WHEN** `requestPin` is called with a `send` operation context at Level 2
- **THEN** the provider SHALL display a page showing full transaction details and a password input field; the transaction SHALL only proceed when the correct password is submitted

### Requirement: GUI secret display dialog
The GuiAuthProvider SHALL support displaying sensitive data (e.g., mnemonic) directly to the user through a secure browser page, without returning the data through IPC.

#### Scenario: Display mnemonic to user
- **WHEN** `displaySecretToUser` is called with a title and secret content
- **THEN** the provider SHALL open a browser page displaying the secret in a readable format with a "Copy to clipboard" button and a 60-second auto-close countdown

#### Scenario: Secret page security headers
- **WHEN** the secret display page is served
- **THEN** the HTTP response SHALL include `Cache-Control: no-store`, `Pragma: no-cache`, and the page SHALL disable right-click context menu

#### Scenario: Secret page auto-destruction
- **WHEN** 60 seconds elapse after the secret page is opened, or the user clicks "Close"
- **THEN** the page SHALL clear its DOM content, close the browser tab (if permitted), and the HTTP server SHALL shut down

### Requirement: Cross-platform browser opening
The GuiAuthProvider SHALL open the system default browser on macOS, Windows, and Linux.

#### Scenario: macOS browser launch
- **WHEN** the provider needs to open a URL on macOS
- **THEN** it SHALL execute `open <url>` via `child_process`

#### Scenario: Windows browser launch
- **WHEN** the provider needs to open a URL on Windows
- **THEN** it SHALL execute `start <url>` via `child_process`

#### Scenario: Linux browser launch
- **WHEN** the provider needs to open a URL on Linux
- **THEN** it SHALL execute `xdg-open <url>` via `child_process`

#### Scenario: No browser available
- **WHEN** the browser open command fails
- **THEN** the provider SHALL print the URL to stderr and instruct the user to open it manually
