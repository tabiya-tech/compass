# Research Notes - GA4 Registration Code Tracking

## Decisions

1) Decision: GA4 `user_id` will equal `registration_code` for secure-link users; legacy users keep internal `user_id`.
   Rationale: GA4 User-ID is the supported way to stitch sessions across devices and is exposed in BigQuery exports; using `registration_code` as `user_id` keeps journeys filterable and exportable without custom dimensions.
   Alternatives considered: (a) Custom dimension for `registration_code` (would not drive User Explorer stitching); (b) Event parameter only (harder to filter at user level and risks missing on some events).

2) Decision: Capture `registration_code` from the secure link, store in `sessionStorage`, and push to dataLayer upon successful login/registration.
   Rationale: Session-scoped storage minimizes persistence risk while surviving navigation; pushing on auth success ensures the identifier is tied to the authenticated user.
   Alternatives considered: (a) `localStorage` (persists too long and risks stale codes); (b) cookies (extra policy/samesite work without added value here).

3) Decision: GTM will read `user_id` from dataLayer and set GA4 config tag User-ID; GA4 events will inherit via config.
   Rationale: Centralizing user_id in GA4 config avoids per-event overrides and aligns with existing dataLayer patterns.
   Alternatives considered: (a) Setting user_id on every event push (higher risk of omissions); (b) GA4 client-side gtag `set` calls outside GTM (splits configuration paths).

4) Decision: Preserve timestamps/params by only augmenting identifiers; do not alter existing event payloads beyond adding `user_id`.
   Rationale: Avoids regressions in current analytics and keeps exports backward compatible.
   Alternatives considered: (a) Rebuilding event schemas to include new params everywhere (unnecessary churn); (b) Duplicating user_id into event params (extra noise—only do if GA query convenience is needed later).

5) Decision: BigQuery exports remain GA4-managed (events_*/users_*) with no code changes; analysts query by `user_id` and join to internal PII outside GA4.
   Rationale: GA4 to BigQuery linking already provides user_id; keeping codebase untouched avoids infra drift.
   Alternatives considered: (a) Custom ETL duplicating GA data (overkill); (b) Adding backend export paths (out of scope, increases compliance surface).

6) Decision: On logout, clear stored `registration_code`/user_id to prevent misattribution; on subsequent logins, set `user_id` from the authenticated user profile (not from URL, since secure link is single-use).
   Rationale: Secure links are used only once; relying on URL recapture would fail. Using the user profile keeps attribution stable across sessions without exposing codes in URLs.
   Alternatives considered: (a) Persist across logout (risk of cross-user leakage on shared devices); (b) Requiring re-entry via secure link (not possible post-registration).

## Open Items Resolved

- BigQuery handling is documentation-only; no code changes needed—queries will rely on GA4 `user_id`.
- No backend changes planned; frontend-only instrumentation is sufficient given existing invite flows.
