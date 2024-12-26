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

To set up an invitation code, add an entry to the `user_invitations` collection in the `application database`. Below is the JSON structure for reference:

```json
{
  "_id": {
    "$oid": "<random object id>"
  },
  "allowed_usage": 1000,
  "invitation_code": "<e.g., login-01>",
  "invitation_type": "LOGIN or REGISTER",
  "remaining_usage": 1000,
  "valid_from": {
    "$date": "2020-01-01T00:00:00.000Z"
  },
  "valid_until": {
    "$date": "2020-12-31T23:59:59.999Z"
  }
}
```

### keynotes

- **`invitation_type`**:
    - Use `LOGIN` for login codes.
    - Use `REGISTER` for registration codes.

- Ensure:
    - `valid_from` and `valid_until` define the validity period.
    - `allowed_usage` sets the maximum number of times the code can be used.
