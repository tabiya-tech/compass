# Data Model - GA4 Registration Code Tracking

## Entities

### RegistrationCode
- **Fields**: `value` (string, required), `status` (valid|expired|invalid), `source` (secure link), `captured_at` (timestamp, client capture time).
- **Validation**: Must be present on secure-link flow; ignore if missing/invalid.
- **Relationships**: Associates to exactly one user journey when registration succeeds.

### UserIdentifier
- **Fields**: `type` (registration_code|user_id), `value` (string, required), `set_at` (timestamp), `cleared_at` (timestamp, optional).
- **Validation**: Only one active identifier per user/session; registration_code only for secure-link users, user_id only for legacy users.
- **Relationships**: Applied to GA4 user context and inherited by all events.

### SessionIdentity
- **Fields**: `registration_code` (optional), `user_id` (optional), `storage` (sessionStorage), `last_updated_at` (timestamp).
- **Validation**: Clear on logout; populate from secure-link URL on first registration; on later logins populate from authenticated user profile; must not mix registration_code with legacy user_id in the same session.
- **Relationships**: Supplies dataLayer user_id push on login/auth success using URL-derived code on first run, otherwise user profile data.

### GA4Event
- **Fields**: `event_name`, `event_timestamp`, `event_params` (existing), `user_id` (from GA4 config), `session_id` (existing, if any).
- **Validation**: `user_id` required for secure-link journeys; must equal internal user_id for legacy; timestamps unchanged.
- **Relationships**: Exported to BigQuery in `events_*` with `user_id` column, enabling joins.

## State Transitions

1) First secure-link visit: registration_code parsed → stored in SessionIdentity.registration_code.
2) User registers/logs in: SessionIdentity promotes identifier to GA4 User-ID via dataLayer push.
3) Subsequent logins (no secure link): fetch authenticated user profile → populate SessionIdentity with registration_code (if present) or legacy user_id → push to dataLayer.
4) Event emission: GA4 config tag reads user_id from dataLayer → all events carry that identifier.
5) Logout: clear SessionIdentity and GA4 user_id to avoid cross-user leakage.
