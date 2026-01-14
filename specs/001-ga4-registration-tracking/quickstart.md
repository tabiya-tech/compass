# Quickstart - GA4 Registration Code Tracking

1) Frontend capture: Parse `registration_code` from secure-link URL on first visit, store in `sessionStorage`, and on auth success push `user_identity_set` to dataLayer with `user_id=registration_code` (or internal `user_id` for legacy). On subsequent logins (no secure link), load identifier from authenticated user profile and push to dataLayer. Clear on logout.
2) GTM config: Create Data Layer Variable `user_id`; GA4 Config Tag → User-ID = `user_id`; ensure config fires after identity push or refire config when identity is set.
3) GA4 property: Enable User-ID, publish GTM changes, verify in GA4 DebugView/Realtime that events include `user_id` for both flows.
4) QA steps: Secure-link register → login → trigger standard/custom events (chat, navigation). Confirm consistent `user_id` across events; repeat for legacy flow confirming absence of `registration_code`.
5) BigQuery: Ensure GA4-BQ linking enabled. Query `events_*` filtering on `user_id`; expect columns `user_id`, `event_name`, `event_timestamp`, `event_params`. Join to internal PII outside GA4.
6) Tests: Run `yarn lint`/`yarn test` for touched frontend modules; manual GA4 DebugView validation; no backend or IaC changes expected.
