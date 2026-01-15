# Contract: GA4 User Identifier Propagation

## dataLayer Payloads

### Secure-link auth success
```json
{
  "event": "user_identity_set",
  "user_id": "<registration_code>",
  "identifier_type": "registration_code",
  "auth_state": "logged_in"
}
```

### Legacy auth success
```json
{
  "event": "user_identity_set",
  "user_id": "<internal_user_id>",
  "identifier_type": "user_id",
  "auth_state": "logged_in"
}
```

### Logout
```json
{
  "event": "user_identity_cleared"
}
```

## GTM Mapping
- GA4 Config Tag: set `User-ID` to Data Layer Variable `user_id`.
- Trigger: GA4 config fires on all pages; ensure `user_identity_set` pushes occur before subsequent events.
- Optional custom dimension: `identifier_type` (scope: user) if analysts need to filter secure-link vs legacy.

## Event Behavior
- After `user_identity_set`, all GA4 events inherit `user_id` via config tag.
- Legacy flow MUST NOT send `registration_code`; secure-link flow MUST use `registration_code` consistently.
- On `user_identity_cleared`, GTM should clear `user_id` (e.g., via config update or page reload) to prevent cross-user leakage.

## BigQuery Expectations
- `events_*` tables: `user_id` column populated with `registration_code` (secure-link) or internal `user_id` (legacy).
- `event_params` remain unchanged; timestamps preserved.
- Analysts filter by `user_id` and join to internal PII outside GA4.
