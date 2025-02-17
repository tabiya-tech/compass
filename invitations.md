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