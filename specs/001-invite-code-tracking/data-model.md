# Data Model - Invite Code Tracking

## Entities

### RegistrationCode (invitation)
- Fields: `invitation_code` (string, unique), `allowed_usage` (int), `remaining_usage` (int), `valid_from`, `valid_until`, `invitation_type` (REGISTER), `sensitive_personal_data_requirement`.
- Notes: Personalized links set `allowed_usage=1`; `remaining_usage` decremented on successful registration to enforce single-use.

### UserProfile
- Fields (existing + new): `user_id` (internal), `email`, `auth_provider` (google|password), `registration_code` (string, from invitation), `invitation_code` (string), other profile fields.
- Notes: `registration_code` stored at registration time for reporting/analytics; should remain immutable after claim.

### RegistrationSession (client-side)
- Fields: `incoming_code` (from URL), `stored_code` (localStorage `registrationCode`), `source` (link/manual), `lock_state` (locked when link code present), `validation_status` (valid/invalid/used), `auth_method` (google/email).
- Notes: Last link wins; missing storage falls back to default invitation flow.

### AnalyticsEvent
- Fields: `event_name` (`first_visit`, `registration_complete`), `registration_code`, `user_id` (if available), `timestamp`, `source` (google/email), additional GA context.
- Notes: Non-blocking emit; failures logged but do not stop registration.

## Relationships
- `RegistrationCode` (invitation) is consumed by one `UserProfile` when personalized (allowed_usage=1).
- `UserProfile.registration_code` references the `RegistrationCode.invitation_code` used at signup.
- `AnalyticsEvent.registration_code` ties GA/GTM events to the user and report lookup.
- Report retrieval prefers `registration_code`; for users created under the shared/default invitation, the system falls back to `user_id` (with token) to disambiguate reports.

## Validation Rules
- `invitation_code` must exist, be valid in time window, and have `remaining_usage>0` before registration proceeds.
- Duplicate registration attempts with the same `invitation_code` must be blocked once `remaining_usage` reaches 0.
- When no link code is present, keep legacy shared invitation code path unchanged and editable.
