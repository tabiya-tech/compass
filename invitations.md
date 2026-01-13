# Invitation Codes

## Overview

Invitation codes manage user access to the application and are categorized into two types:

1. Login Codes
    Provide **temporary and anonymous access**, ideal for trials, evaluations, or short-term use.
   - _Users with login codes cannot retain their chat history after logging out._
2. Registration Codes:
   Enable **permanent user registration**, they are required for any user to create an account.
   - _Users with registration codes can log in, log out, and log back in while retaining their chat history._

### Secure registration links

- Tokenized links carry a `registration_code` plus a validation token backed by `SEC_TOKEN`; the UI auto-fills and locks the code and surfaces the backend validation result (missing/invalid tokens are blocked).
- The last secure link opened in the session wins (persisted through the registration page) until the user switches to the manual path.
- Duplicate `registration_code` submissions are rejected; successful signups store the code on the user profile and a secure-link claim entry.

### Manual/shared invitations

- When no tokenized link is present, users can enter a shared `invitation_code`; this path remains unlimited-use and editable.
- Reporting and analytics prefer `registration_code` when available and fall back to `user_id` for legacy or manual-invitation users.

## Managing Invitation Codes

Scripts are available in [backend/scripts/setup_invitation_codes](backend/scripts/setup_invitation_codes) to manage invitation codes. Ensure you have activated the backend virtual environment and installed required packages (see [backend/README.md](backend/README.md#installation)).

### Import or Update Invitation Codes

Use `import_invitations.py` to create new codes or update existing ones from a JSON file:

```bash
cd backend
# Dry-run (preview changes)
poetry run python scripts/setup_invitation_codes/import_invitations.py --input-file <json-file>

# Actually import/update codes
poetry run python scripts/setup_invitation_codes/import_invitations.py --input-file <json-file> --hot-run
```

See [sample.json](backend/scripts/setup_invitation_codes/sample.json) for the expected JSON format.

### List Invitation Codes

View all invitation codes with their status:

```bash
cd backend
poetry run python scripts/setup_invitation_codes/list_invitations.py
```

### Delete Invitation Codes

Remove a specific invitation code:

```bash
cd backend
poetry run python scripts/setup_invitation_codes/list_invitations.py --delete <invitation-code>
```

## Frontend Invitation Codes Settings

The frontend client supports several configuration options to control login and registration behavior using invitation codes. For installation details, see the [frontend documentation](/frontend-new/README.md#installation).
Depending on the settings, here are some caveats on how they work together.

### Login by Invitation Code (Disabled/Enabled)

#### Landing Page Behavior

1. If an `application default login code` is set, a `Continue as Guest` button will be visible, which uses the default login code to log the user in anonymously.
2. Always, `Login` button will be shown. If registration is enabled, a `Register` button will also be available.

#### Invitation Code via URL Search Param

If a login code is provided in the URL search parameters, it will always be used.
This was chosen to provide developers with a backdoor into the application when both registration and login codes are disabled.

#### Login Page Behavior

1. If an application default login code is set, a `Continue as Guest` button will be shown, which uses the default login code to log user in anonymously.
2. If login by invitation code is disabled, only credential-based login will be available, even if a default login code exists.
3. Otherwise, users will have three login options:

    * By invitation code
    * By credentials
    * By authentication providers


### Registration (Disabled/Enabled)

#### Landing Page Behavior

1. If registration is disabled, the **Register** button will not appear.
2. If registration is enabled, the **Register** button will be visible.

#### Registration Code via URL Search Param

If a registration code is provided in the URL search parameters, it will only be valid if registration is enabled.
This prevents confusion for users when registration is disabled.
If developers need access, they can still use an invitation code and later convert it to a permanent account inside the application.

#### Login Page Behavior

If registration is disabled, the login page will hide the **Register** link.

### Combination of Settings

If both **login by invitation code** and **registration** are disabled:

* The landing page will only show the **Login** button.
* The login page will only allow login via credentials or authentication providers.
