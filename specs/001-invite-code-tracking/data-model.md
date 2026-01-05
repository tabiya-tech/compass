# Data Model - Invite Code Tracking

## Entities

### SecureLinkCodeClaim
- Fields: `registration_code` (string, unique), `claimed_user_id`, `claimed_at`, `claim_source` (secure_link | invitation | manual), `report_token_hash`, optional `invitation_code_template` (for legacy shared invites), `metadata` (e.g., locale, campaign).
- Notes: Secure links do **not** require pre-inserted DB rows; the first successful registration with a tokenized link creates/updates this claim record. Manual/shared invitations can still create claims originating from `invitation_code`.

### UserProfile
- Fields (existing + new): `user_id` (internal), `email`, `auth_provider` (google|password), `registration_code` (string, from secure link or invitation), `invitation_code` (string), other profile fields.
- Notes: `registration_code` stored at registration time for reporting/analytics and references the SecureLinkCodeClaim; should remain immutable after claim.

### RegistrationSession (client-side)
- Fields: `incoming_code` (from URL), `stored_code` (localStorage `registrationCode`), `source` (link/manual), `lock_state` (locked when link code present), `validation_status` (valid/invalid/used), `auth_method` (google/email).
- Notes: Last link wins; missing storage falls back to default invitation flow.

### AnalyticsEvent
- Fields: `event_name` (`first_visit`, `registration_complete`), `registration_code`, `user_id` (if available), `timestamp`, `source` (google/email), additional GA context.
- Notes: Non-blocking emit; failures logged but do not stop registration.

## Relationships
- Each `SecureLinkCodeClaim` is associated to at most one `UserProfile`. Claims may originate from secure links (created on first use) or from legacy invitations (pre-existing rows) but share the same uniqueness constraint.
- `UserProfile.registration_code` references the associated `SecureLinkCodeClaim.registration_code`.
- `AnalyticsEvent.registration_code` ties GA/GTM events to the user and report lookup.
- Report retrieval prefers `registration_code`; for users created under the shared/default invitation, the system falls back to `user_id` (with token) to disambiguate reports.

## Validation Rules
- Secure-link flows: a valid `report_token` must accompany the code; if the code has already been claimed (i.e., exists on another user profile / claim record), block registration. No pre-existing invitation record is required.
- Manual/shared invitation flows: `invitation_code` must still exist and be valid in the allowed time window, but it carries unlimited usage (no remaining-usage decrement) before registration proceeds; resulting registration should create/associate a SecureLinkCodeClaim to maintain a single mechanism.
- When no link code is present, keep legacy shared invitation code path unchanged and editable.
