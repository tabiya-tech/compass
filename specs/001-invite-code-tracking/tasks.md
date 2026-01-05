# Tasks: Invite Code Tracking

**Input**: Design documents from `/specs/001-invite-code-tracking/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Confirm dev env and secrets for backend/frontend-new per quickstart (no code changes)
- [ ] T002 [P] Sync local feature branch with `001-invite-code-tracking` context and perform lightweight checks only (e.g., `poetry run pytest tests/test_invitations_registration.py -q` and `yarn lint`) to avoid full suite runtime

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T003 Define registration code param/label constants (`reg_code`, display label "registration code") in frontend-new/src/config/registrationCode.ts
- [x] T004 Add registration_code field to backend user profile schema/model and serialization in backend/app/users (and related pydantic models)
- [x] T005 Define SecureLinkCodeClaim persistence in backend/app/invitations by extending the existing invitations collection (no new collection): add a claim record type with registration_code, claimed_user_id, claim_source, report_token_hash, and link from backend/app/users
- [x] T006 [P] Document secure-link vs manual/shared invitation flows (manual path unlimited uses, invitation_code manual-only) in backend/app/README.md and frontend-new docs
- [x] T007 Ensure `/user-invitations/check-status` exposes structured statuses (VALID/USED/INVALID/401) for both secure-link (`reg_code` + token) and manual `invitation_code` paths in backend/app/invitations/routes.py
- [x] T008 [P] Add fallback identifier note (registration_code preferred, user_id fallback) to backend/app/README.md and frontend-new docs

**Checkpoint**: Foundation ready - user story work can start.

---

## Phase 3: User Story 1 - Register via personalized link (Priority: P1) 🎯 MVP

**Goal**: Auto-fill and lock a link-supplied registration code, validate with token + uniqueness, carry through Google/email signup, store on user/claim log, and push analytics without pre-provisioned invitations.

**Independent Test**: Open /register?token=EMP&reg_code=CODE (CODE absent in DB), see locked field + toast, complete Google/email signup, code stored on user + claim log, duplicate attempt blocked, analytics events include registration_code.

### Implementation

- [x] T009 [P] [US1] Parse `reg_code` + `report_token` from URL and store latest in state in frontend-new/src/pages/register/index.tsx
- [x] T010 [P] [US1] Auto-fill, lock field, and show toast on apply in frontend-new/src/components/auth/InvitationCodeField.tsx
- [x] T011 [US1] Call `/user-invitations/check-status` with `reg_code` + token before submit; surface VALID/USED/INVALID/missing-token states in frontend-new/src/services/invitationsClient.ts
- [x] T012 [US1] Pass registration_code through email/password signup payload in frontend-new/src/services/auth/emailSignup.ts
- [x] T013 [US1] Pass registration_code through Google signup payload in frontend-new/src/services/auth/googleSignup.ts
- [x] T014 [US1] Enforce code-required-when-present and disable manual edits when a link code exists in frontend-new/src/state/registrationStore.ts
- [x] T015 [US1] Enforce backend uniqueness for registration_code (secure-link path) while keeping manual/shared invitation codes unlimited in backend/app/users/routes.py (or signup handler)
- [x] T016 [US1] Store registration_code on user record and append SecureLink claim log with token provenance in backend/app/users (and claim storage)
- [x] T017 [US1] Push analytics events (`first_visit`, `registration_complete`) including registration_code in frontend-new/src/services/analytics/dataLayer.ts
- [x] T018 [US1] Maintain manual/shared invitation path: accept manual `invitation_code` without capacity decrement when no token/reg_code is present in backend/app/invitations/routes.py
- [x] T036 [US1] Validate `report_token` server-side for secure-link registration (check-status + signup handler) and block auto-fill/submit when invalid in backend/app/invitations/routes.py and backend/app/users/routes.py

### Tests (per spec expectations)

- [ ] T019 [P] [US1] Backend test: secure-link signup stores registration_code, rejects duplicates, and leaves manual invitation capacity untouched in backend/tests/test_invitations_registration.py
- [ ] T020 [P] [US1] Frontend test: auto-fill + lock + toast + VALID/USED/INVALID flows in frontend-new/test/register/registrationCode.test.tsx
- [ ] T021 [P] [US1] Frontend test: missing/invalid token blocks code application in frontend-new/test/register/registrationCodeSecurity.test.tsx
- [ ] T022 [P] [US1] Backend regression test: manual shared invitation path succeeds without token and without capacity decrement in backend/tests/test_invitations_registration.py
- [ ] T037 [P] [US1] Backend test: missing/invalid `report_token` on secure-link registration is rejected in backend/tests/test_invitations_registration.py

**Checkpoint**: User Story 1 independently testable.

---

## Phase 4: User Story 2 - Resume or switch link with persistence (Priority: P2)

**Goal**: Persist latest link code (last-link-wins), restore on return, keep field locked, and fall back cleanly when storage absent.

**Independent Test**: Visit link A, leave, return to see A locked; open link B, B replaces A; storage unavailable falls back to manual invitation flow.

### Implementation

- [ ] T023 [P] [US2] Persist registration_code to localStorage (`registrationCode`) on arrival; hydrate on load in frontend-new/src/state/registrationStore.ts
- [ ] T024 [US2] Implement last-link-wins override and clear stale stored code when URL lacks reg_code in frontend-new/src/pages/register/index.tsx
- [ ] T025 [US2] Keep field locked when stored/link code exists; allow manual entry only when none exists in frontend-new/src/components/auth/InvitationCodeField.tsx

### Tests (per spec expectations)

- [ ] T026 [P] [US2] Frontend test: last-link-wins and persistence on revisit in frontend-new/test/register/registrationCodePersistence.test.tsx
- [ ] T027 [P] [US2] Frontend test: storage unavailable/cleared falls back to manual invitation flow in frontend-new/test/register/registrationCodePersistence.test.tsx

**Checkpoint**: User Story 2 independently testable.

---

## Phase 5: User Story 3 - Admin views report by code or fallback (Priority: P3)

**Goal**: Retrieve reports by registration_code (preferred) or fallback user_id for legacy/shared-invite users, with token validation unchanged.

**Independent Test**: Report URL with registration_code+token returns correct user; unknown code errors; fallback user_id+token works for users without personalized code.

### Implementation

- [ ] T028 [P] [US3] Update report API lookup to accept registration_code or fallback user_id, preferring registration_code, in backend/app/conversations/routes.py (or report handler)
- [ ] T029 [US3] Ensure token validation unchanged and errors non-leaky in backend/app/conversations/routes.py
- [ ] T030 [P] [US3] Update frontend-new report route to accept `reg_code` or `user_id` param and call updated endpoint in frontend-new/src/pages/reports/[id].tsx

### Tests (per spec expectations)

- [ ] T031 [P] [US3] Backend test: report fetch by registration_code and fallback user_id in backend/tests/test_reports_by_registration_code.py
- [ ] T032 [P] [US3] Frontend test: report fetch via registration_code and fallback user_id in frontend-new/test/reports/reportLookup.test.tsx

**Checkpoint**: User Story 3 independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T033 [P] Update user/admin-facing copy to use neutral "registration code" wording in frontend-new/src/i18n
- [ ] T034 Validate accessibility (focus, toast announcements, labels) for new UI via `yarn test-storybook` in frontend-new
- [ ] T035 [P] Add logging for analytics push failures and code validation errors without leaking PII in backend/app/logger.py and frontend-new/src/services/analytics/dataLayer.ts

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → User Stories (3/4/5) → Phase 6.
- User stories can proceed in parallel after Phase 2; complete US1 before US2/US3 reliance on registration_code data.

## User Story Dependency Graph

- US1 (P1): foundational for code creation/storage
- US2 (P2): depends on foundational; logic reuses US1 field/locking behavior
- US3 (P3): depends on foundational; reads data created in US1; provides fallback for legacy/manual users

## Parallel Execution Examples

- US1: T009, T010, T011, T012, T013, T017 can start in parallel; T015-T016 depend on backend claim/payload wiring.
- US2: T023 and T026 can run in parallel; T024 depends on T023 hydration logic.
- US3: T028 and T030 can run in parallel; T031-T032 follow handler updates.

## Implementation Strategy

- MVP: Complete Phases 1-2 then US1 to deliver secure-link registration with uniqueness + analytics.
- Incremental: Add US2 persistence, then US3 report lookup fallback; finish with polish/accessibility and logging.

