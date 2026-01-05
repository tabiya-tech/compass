# API Contracts - Invite Code Tracking

## 1) Validate registration code (secure link aware)
- **Endpoint**: `GET /user-invitations/check-status`
- **Query**:
  - `reg_code` (string, optional) — present for secure links
  - `report_token` (string, optional) — required when `reg_code` is present
  - `invitation_code` (string, optional) — provided only when a user manually types the shared legacy code (no secure link)
- **Responses**:
  - 200 VALID: `{ code: "40007310", status: "VALID", source: "secure_link", sensitive_personal_data_requirement }`
  - 200 USED: `{ code: "40007310", status: "USED" }`
  - 200 INVALID: `{ code: "40007310", status: "INVALID" }`
  - 401/403: Missing or invalid token when `reg_code` supplied
  - 500: Error payload
- **Notes**: When `reg_code` + token are provided, backend checks whether the code is already claimed in user data. If unclaimed, respond `VALID` even if no invitation row exists. When no token is supplied, fall back to the legacy `invitation_code` validation path triggered by manual entry. Admins never embed `invitation_code` inside the URLs they share.

## 2) Registration with code (frontend-new + backend integration)
- **Flow**: On registration submit (Google or email), frontend includes the active `registration_code` and the original `report_token` (when present). For legacy/manual flows—where a user manually types the shared invitation code without any secure link—the frontend sends only `invitation_code`. Backend persists the applied code on user data and the secure-link claim log; legacy/manual invitation codes are unlimited and do not decrement capacity.
- **Expected backend behavior**:
  - Reject secure-link submissions when the token is missing/invalid or when the `registration_code` is already claimed.
  - Reject manual/shared invitation submissions only when the invitation code itself is invalid or revoked; availability is no longer tied to usage counts.
  - On success, store `registration_code` on the user record, persist/append the claim log (including source + timestamp), and leave invitation capacity untouched for the manual code path.
- **Notes**: Existing signup endpoints remain; they simply accept the extra metadata to drive the secure-link logic.

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
