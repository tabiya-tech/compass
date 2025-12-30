# API Contracts - Invite Code Tracking

## 1) Validate registration code (reuse existing endpoint)
- **Endpoint**: `GET /user-invitations/check-status`
- **Query**: `invitation_code` (string)
- **Responses**:
  - 200 VALID: `{ invitation_code, status: "VALID", invitation_type, sensitive_personal_data_requirement }`
  - 200 INVALID: `{ invitation_code, status: "INVALID", sensitive_personal_data_requirement: "NOT_AVAILABLE" }`
  - 500: Error payload
- **Notes**: Personalized codes are created with `allowed_usage=1`. Frontend blocks registration when status is INVALID. Backend decrements capacity on successful registration.

## 2) Registration with code (frontend-new + backend integration)
- **Flow**: On registration submit (Google or email), frontend includes the active `registration_code` in the payload/headers used by the existing signup path so backend can persist it on user data and reduce invitation capacity.
- **Expected backend behavior**:
  - Reject if invitation is invalid or already consumed (remaining_usage <= 0).
  - On success, store `registration_code` on the user record and keep the invitation record for auditing; decrement `remaining_usage`.
- **Notes**: Align with existing auth/signup endpoint naming (to be confirmed during implementation); no new endpoint is expected if current registration accepts invitation code metadata.

## 3) Report retrieval by code or fallback id
- **Endpoint**: Existing report fetch endpoint (token-protected) should accept `registration_code`; when a user was created under the shared/default invitation (no personalized code), it should also accept a fallback `user_id`. URL patterns: `#/reports/{registration_code}?token=...` or `#/reports/{user_id}?token=...`.
- **Behavior**:
  - Return report data bound to the user who registered with the provided `registration_code` (preferred) or `user_id` (fallback) when token is valid.
  - For unknown/unused identifiers, return an error or empty state without leaking other users.
- **Notes**: Keep existing token validation; when both identifiers are present, prefer `registration_code`; fallback exists to support legacy/shared-invite users.

## 4) Analytics data layer payloads
- **Events**: `first_visit`, `registration_complete`
- **Fields**: `registration_code`, `auth_method`, `timestamp`, plus existing GA context.
- **Notes**: Fire non-blocking; log failures. Does not require backend changes unless analytics events are proxied server-side.
