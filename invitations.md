# Invitation Codes

## Overview

Invitation codes manage user access to the application and are categorized into two types:

1. Login Codes
    Provide **temporary and anonymous access**, ideal for trials, evaluations, or short-term use.
   - _Users with login codes cannot retain their chat history after logging out._
2. Registration Codes:
   Enable **permanent user registration**, they are required for any user to create an account.
   - _Users with registration codes can log in, log out, and log back in while retaining their chat history._

## Setting Up Invitation Codes

To set up an invitation code, use the `import_invitations.py` python script found in [backend/scripts/setup_invitation_codes](backend/scripts/setup_invitation_codes). 

To run the script you need to have activated the virtual environment of the backend and installed the required packages (see [backend/README.md](backend/README.md#installation)).

Run the following command to get help on the script:
```bash
# make sure you have activated the backend virtual environment
cd backend/scripts/setup_invitation_codes
python import_invitations.py --help
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
