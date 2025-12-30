# Tasks: Invite Code Tracking

**Input**: Design documents from `/specs/001-invite-code-tracking/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Confirm dev env and secrets for backend/frontend-new per quickstart (no code changes)
- [ ] T002 [P] Sync local feature branch with `001-invite-code-tracking` context and ensure lint/test commands run (`./run-before-merge.sh` dry check)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T003 Define registration code param/label constants (e.g., `reg_code`, display "registration code") in frontend-new/src/config/registrationCode.ts
- [ ] T004 Add registration_code field to user profile data model and persistence layer in backend/app/users (model/schema + serialization)
- [ ] T005 Wire backend invitation uniqueness assumption: personalized invite template with `allowed_usage=1` documented in backend/app/invitations (comment/config) without breaking shared default code
- [ ] T006 [P] Document fallback identifier strategy (registration_code preferred, user_id fallback) in backend/app/README.md and frontend-new docs references
- [ ] T007 Ensure backend validation errors for invitation code are surfaced as structured responses (status invalid/used) in backend/app/invitations/routes.py

**Checkpoint**: Foundation ready - user story work can start.

---

## Phase 3: User Story 1 - Register via personalized link (Priority: P1) 🎯 MVP

**Goal**: Auto-fill and lock a link-supplied registration code, validate it, carry it through Google/email signup, store on invitation and user, enforce single-use, and push analytics.

**Independent Test**: Open /register?reg_code=CODE, see locked field + toast, complete Google/email signup, code stored on user and invitation usage reduced; duplicate attempt is blocked; analytics events include registration_code.

### Implementation

- [ ] T008 [P] [US1] Parse `reg_code` query and store latest in state in frontend-new/src/pages/register/index.tsx
- [ ] T009 [P] [US1] Auto-fill, lock field, and show toast on apply in frontend-new/src/components/auth/InvitationCodeField.tsx
- [ ] T010 [US1] Call `/user-invitations/check-status` before submit; block invalid/used codes with UX message in frontend-new/src/services/invitationsClient.ts
- [ ] T011 [US1] Pass registration_code through email/password signup flow payload in frontend-new/src/services/auth/emailSignup.ts
- [ ] T012 [US1] Pass registration_code through Google signup flow payload in frontend-new/src/services/auth/googleSignup.ts
- [ ] T013 [US1] Enforce code required when present in URL/storage and disable manual edits in frontend-new/src/state/registrationStore.ts
- [ ] T014 [US1] On backend, accept registration_code on signup request and persist to user record in backend/app/users/routes.py (or relevant signup handler)
- [ ] T015 [US1] Decrement invitation remaining_usage atomically on successful signup; return conflict if remaining_usage<=0 in backend/app/invitations/repository.py
- [ ] T016 [US1] Store applied registration_code on invitation usage/audit trail in backend/app/invitations/repository.py
- [ ] T017 [US1] Push analytics events (`first_visit`, `registration_complete`) with registration_code in frontend-new/src/services/analytics/dataLayer.ts
- [ ] T018 [P] [US1] Add backend test covering: valid code signup stores code and reduces capacity; duplicate signup blocked in backend/tests/test_invitations_registration.py
- [ ] T019 [P] [US1] Add frontend test for auto-fill + lock + toast + validation error state in frontend-new/test/register/registrationCode.test.tsx

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

**Checkpoint**: User Story 3 independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T029 [P] Update user/admin-facing copy to use neutral "registration code" wording in frontend-new/src/i18n strings
- [ ] T030 Validate accessibility (focus, toast announcements, labels) for new UI in frontend-new via `yarn test-storybook`
- [ ] T031 [P] Add logging for analytics push failures and code validation errors without leaking PII in backend/app/logger.py and frontend-new/src/services/analytics/dataLayer.ts
- [ ] T032 Run full quality gate `./run-before-merge.sh` and fix any regressions

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
