# Tasks - GA4 Registration Code Tracking

Feature: GA4 Registration Code Tracking  
Branch: `001-ga4-registration-tracking`

## Phase 1 - Setup
- [ ] T001 Confirm GA4 User-ID feature enabled in target property (document status in specs/001-ga4-registration-tracking/quickstart.md)
- [ ] T002 [P] Verify GTM container access and identify GA4 config tag name (document in specs/001-ga4-registration-tracking/quickstart.md)
- [ ] T003 Prepare frontend-new environment (env.js present) and run `yarn install` (log in specs/001-ga4-registration-tracking/quickstart.md)

## Phase 2 - Foundational
- [x] T004 Define analytics helper scaffold for user identity handling in frontend-new/src/analytics/identity.ts
- [x] T005 Add unit test scaffold for identity helper in frontend-new/src/analytics/identity.test.ts
- [x] T006 Verify authenticated user profile exposes `registration_code` (or equivalent) for secure-link users; document path or needed hook in specs/001-ga4-registration-tracking/quickstart.md
- [x] T007 Add profile-based identifier loader for post-first-login sessions in frontend-new/src/analytics/identity.ts (use profile when no URL code)

## Phase 3 - User Story 1 (P1) Secure-link registrant events carry registration_code
- [x] T008 [US1] Parse `registration_code` from secure-link URL and store in sessionStorage in frontend-new/src/analytics/identity.ts (ignore if missing/invalid)
- [x] T009 [US1] On auth success for secure-link users, push `user_identity_set` with `user_id=registration_code` to dataLayer in frontend-new/src/analytics/identity.ts
- [x] T010 [US1] On logout, clear session identity and push `user_identity_cleared` to dataLayer in frontend-new/src/analytics/identity.ts
- [ ] T011 [US1] Ensure GA4 config tag picks up `user_id` via dataLayer variable (document GTM steps in specs/001-ga4-registration-tracking/contracts/ga4-user-id.md)
- [x] T012 [US1] Minimal test/QA: simulate secure-link login flow and assert dataLayer pushes include registration_code (frontend-new/src/analytics/identity.test.ts)

## Phase 4 - User Story 2 (P2) Legacy invite tracking stays on internal user_id
- [x] T013 [US2] When no registration_code, set `user_id` from authenticated profile (internal user_id) and push `user_identity_set` in frontend-new/src/analytics/identity.ts
- [x] T014 [US2] Guard against mixing identifiers (do not attach registration_code for legacy) in frontend-new/src/analytics/identity.ts
- [x] T015 [US2] Minimal test/QA: simulate legacy login and assert dataLayer push uses internal user_id and no registration_code (frontend-new/src/analytics/identity.test.ts)

## Phase 5 - User Story 3 (P3) Analysts can filter and export journeys by registration_code
- [ ] T016 [US3] Document GA4 User Explorer filter and BigQuery query snippet (events_* by user_id) in specs/001-ga4-registration-tracking/quickstart.md
- [ ] T017 [US3] Validate GA4 DebugView/Realtime shows user_id for secure-link and legacy sessions (record checklist in specs/001-ga4-registration-tracking/quickstart.md)

## Final Phase - Polish & Cross-cutting
- [x] T018 Add short README note for analytics identity flow in frontend-new/src/analytics/README.md
- [ ] T019 Run `yarn lint` and targeted `yarn test` for analytics identity files; record results in specs/001-ga4-registration-tracking/quickstart.md
- [ ] T020 Add lightweight data-quality check: warn/log when `user_id` missing or conflicts with identifier_type in frontend-new/src/analytics/identity.ts; document in specs/001-ga4-registration-tracking/quickstart.md

## Dependencies (story order)
1. Phase 1 Setup → Phase 2 Foundational
2. Phase 2 (includes profile exposure T006/T007) → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Final Phase

## Parallel Execution Examples
- Run T001-T003 in parallel (access + env prep) while scaffolding identity helper (T004-T005) if access is already confirmed.
- After T004 baseline, implement T008-T010 (US1 code) in parallel with T011 documentation since GTM mapping is independent of code compile.
- T013-T014 (legacy path) can run once T008 baseline merged, in parallel with T012/T015 minimal tests.

## Implementation Strategy
- MVP: Complete US1 (T004-T012) to ensure secure-link journeys carry registration_code end-to-end with profile fallback ready.
- Incrementally add US2 safeguards (T013-T015) to avoid regressions for legacy users.
- Finalize analyst enablement (US3) and polish/testing/monitoring (T016-T020).
