# Tasks: Invite Code Tracking

**Input**: Design documents from `/specs/001-invite-code-tracking/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Confirm dev env and secrets for backend/frontend-new per quickstart (no code changes)
- [ ] T002 [P] Sync local feature branch with `001-invite-code-tracking` context and manually spot-check backend/frontend-new lint + test commands (skip `run-before-merge.sh` per scope)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T003 Define registration code param/label constants (e.g., `reg_code`, display "registration code") in frontend-new/src/config/registrationCode.ts
- [ ] T004 Add registration_code field to user profile data model and persistence layer in backend/app/users (model/schema + serialization)
- [ ] T005 Document the secure-link claim strategy: tokenized links no longer need per-code invitations, while legacy shared invitations remain documented in backend/app/invitations without breaking existing defaults
- [ ] T006 [P] Document fallback identifier strategy (registration_code preferred, user_id fallback) in backend/app/README.md and frontend-new docs references
- [ ] T007 Ensure backend validation errors for invitation code are surfaced as structured responses (status invalid/used) in backend/app/invitations/routes.py

**Checkpoint**: Foundation ready - user story work can start.

---

## Phase 3: User Story 1 - Register via personalized link (Priority: P1) 🎯 MVP

**Goal**: Auto-fill and lock a link-supplied registration code, validate it (token + uniqueness), carry it through Google/email signup, store it on user/claim logs without requiring a pre-provisioned invitation, and push analytics.

**Independent Test**: Open /register?token=EMP&reg_code=CODE (where CODE was never inserted in Mongo), see locked field + toast, complete Google/email signup, code stored on user/claim log, duplicate attempt is blocked, and analytics events include `registration_code`.

### Implementation

- [ ] T008 [P] [US1] Parse `reg_code` query and store latest in state in frontend-new/src/pages/register/index.tsx
- [ ] T009 [P] [US1] Auto-fill, lock field, and show toast on apply in frontend-new/src/components/auth/InvitationCodeField.tsx
- [ ] T010 [US1] Call the code-validation endpoint before submit; include the admin token when present so unclaimed secure-link codes return `VALID`, and block duplicates/legacy invalid codes with UX messaging in frontend-new/src/services/invitationsClient.ts
- [ ] T011 [US1] Pass registration_code through email/password signup flow payload in frontend-new/src/services/auth/emailSignup.ts
- [ ] T012 [US1] Pass registration_code through Google signup flow payload in frontend-new/src/services/auth/googleSignup.ts
- [ ] T013 [US1] Enforce code required when present in URL/storage and disable manual edits in frontend-new/src/state/registrationStore.ts
- [ ] T015 [US1] Ensure backend uniqueness by rejecting any registration if the `registration_code` already exists on another user/claim (secure-link path) while keeping manual/shared invitation codes unlimited (no capacity decrements)
- [ ] T016 [US1] Store applied registration_code on a secure-link claim log (user preferences and/or dedicated audit trail) so future validations know it is taken
- [ ] T017 [US1] Push analytics events (`first_visit`, `registration_complete`) with registration_code in frontend-new/src/services/analytics/dataLayer.ts
- [ ] T036 [US1] Require the existing admin/report token (`report_token`) alongside `reg_code`, store it with registration state, and block auto-fill when missing in frontend-new/src/pages/register/index.tsx
- [ ] T037 [US1] Validate the admin/report token server-side before honoring registration_code in backend/app/users/routes.py (or relevant signup handler) and surface 4xx errors when invalid
- [ ] T018 [P] [US1] Add backend test covering: valid code signup stores the code without changing invitation capacity; duplicate signup is blocked in backend/tests/test_invitations_registration.py
- [ ] T019 [P] [US1] Add frontend test for auto-fill + lock + toast + validation error state in frontend-new/test/register/registrationCode.test.tsx
- [ ] T038 [US1] Add frontend test ensuring missing/invalid admin token prevents code application and shows the secure-link error state in frontend-new/test/register/registrationCodeSecurity.test.tsx
- [ ] T039 [US1] Add backend test verifying signup with invalid/missing admin token is rejected even if the registration_code exists in backend/tests/test_invitations_registration.py
- [ ] T035 [US1] Add backend regression test ensuring shared/default invitation code registration succeeds when no registration_code is provided in backend/tests/test_invitations_registration.py

**Checkpoint**: User Story 1 independently testable.

---

## Phase 4: User Story 2 - Resume or switch link with persistence (Priority: P2)

**Goal**: Persist the latest link code (last-link-wins), restore on return, block manual edits, and update when a new link is opened.

**Independent Test**: Visit link A, leave, return to see A locked; then open link B, B replaces A and stays locked after navigation.

### Implementation

- [ ] T020 [P] [US2] Persist registration_code to localStorage (`registrationCode`) on arrival; hydrate on load in frontend-new/src/state/registrationStore.ts
- [ ] T021 [US2] Implement last-link-wins override logic and clear stale codes when no query is present in frontend-new/src/pages/register/index.tsx
- [ ] T022 [US2] Keep field locked and non-editable when a stored/link code exists; allow manual entry only when no stored/link code in frontend-new/src/components/auth/InvitationCodeField.tsx
- [ ] T023 [P] [US2] Add frontend test for last-link-wins and persistence on revisit in frontend-new/test/register/registrationCodePersistence.test.tsx
- [ ] T034 [P] [US2] Add frontend test covering storage unavailable/cleared scenario falling back to default invitation flow in frontend-new/test/register/registrationCodePersistence.test.tsx

**Checkpoint**: User Story 2 independently testable.

---

## Phase 5: User Story 3 - Admin views report by code or fallback (Priority: P3)

**Goal**: Allow report retrieval via registration_code (preferred) or fallback user_id for legacy/shared-invite users, keeping token validation.

**Independent Test**: Open report with registration_code+token returns correct user; unknown code errors; report with user_id+token works for users without personalized code.

### Implementation

- [ ] T024 [P] [US3] Update report API lookup to accept registration_code or fallback user_id, preferring registration_code, in backend/app/conversations/routes.py (or report handler)
- [ ] T025 [US3] Ensure token validation unchanged and error responses do not leak other users in backend/app/conversations/routes.py
- [ ] T026 [P] [US3] Add backend test for report fetch by registration_code and fallback user_id in backend/tests/test_reports_by_registration_code.py
- [ ] T027 [US3] Update frontend-new report route to accept either `reg_code` or `user_id` param and call updated endpoint in frontend-new/src/pages/reports/[id].tsx
- [ ] T028 [P] [US3] Add frontend test for report fetch via registration_code and fallback user_id in frontend-new/test/reports/reportLookup.test.tsx
- [ ] T033 [P] [US3] Add backend contract test ensuring registration_code is preferred when both registration_code and user_id are present in backend/tests/test_reports_by_registration_code.py

**Checkpoint**: User Story 3 independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T029 [P] Update user/admin-facing copy to use neutral "registration code" wording in frontend-new/src/i18n strings
- [ ] T030 Validate accessibility (focus, toast announcements, labels) for new UI in frontend-new via `yarn test-storybook`
- [ ] T031 [P] Add logging for analytics push failures and code validation errors without leaking PII in backend/app/logger.py and frontend-new/src/services/analytics/dataLayer.ts

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → User Stories (3/4/5) → Phase 6.
- User stories can proceed in parallel after Phase 2, but US1 should complete before US2/US3 integration validation.

## User Story Dependency Graph

- US1 (P1): foundational
- US2 (P2): depends on foundational; logical dependency on US1 field/lock behavior
- US3 (P3): depends on foundational; reads data created in US1 (registration_code) but supports fallback for legacy users

## Parallel Execution Examples

- US1: T008, T009, T010, T011, T012, T017 can start in parallel; T014-T016 depend on signup payloads.
- US2: T020 and T023 can run in parallel; T021 depends on T020 hydration logic.
- US3: T024 and T027 can run in parallel; tests T026 and T028 can run once handlers/routes are updated.

## Implementation Strategy

- MVP: Complete Phases 1-2 then US1; deploy/validate auto-fill + uniqueness + analytics.
- Incremental: Add US2 persistence, then US3 report lookup fallback; finish with polish/accessibility and full gate.

