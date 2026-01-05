# Implementation Plan: Invite Code Tracking

**Branch**: `001-invite-code-tracking` | **Date**: 2025-12-30 | **Spec**: specs/001-invite-code-tracking/spec.md
**Input**: Feature specification from `/specs/001-invite-code-tracking/spec.md`

## Summary

Implement per-user registration links that auto-fill and lock a "registration code" (DNI alias), persist it across visits, enforce single-use uniqueness, and surface it for analytics/report lookup—while requiring the existing admin/report token on any code-bearing link. Admins do **not** pre-create invitation rows; any `reg_code` embedded in a tokenized link must be accepted (subject to uniqueness) and written directly to user data with optional audit logging. Legacy shared invitations remain for manual entry flows.

## Technical Context

**Language/Version**: Backend Python 3.11 (Poetry); Frontend React/TypeScript (frontend-new).  
**Primary Dependencies**: FastAPI, Motor/MongoDB, Pydantic, Firebase auth flows in frontend-new, GA/GTM data layer, Sentry.  
**Storage**: MongoDB Atlas (user_invitations, users/user profile), localStorage for client-side code persistence.  
**Testing**: Backend pytest suite; Frontend `yarn test`, `yarn lint`, accessibility via `yarn test-storybook`; repo gate `./run-before-merge.sh`.  
**Target Platform**: Backend on Linux container/server; Web clients via frontend-new.  
**Project Type**: Web application (backend + frontend-new).  
**Performance Goals**: No added latency beyond existing invitation check; code auto-fill within ~1s of page load; avoid extra DB roundtrips in signup.  
**Constraints**: Must keep existing shared invitation code flow intact; WCAG 2.0 A for UI changes; avoid exposing PII (use neutral label); enforce single-use by checking claimed codes in user data; last-link-wins persistence; handle both Google and email signup paths; gated registration links must validate the existing admin/report token before applying codes; admins should not require database access to mint codes.
**Scale/Scope**: Supports per-user links at current user volumes; uniqueness enforced by rejecting duplicate `registration_code` claims rather than provisioning individual invitation documents.

## Constitution Check

- Monorepo: scope is strictly backend + `frontend-new`; changes to the legacy `frontend/` folder are out of bounds for this feature.
- Security/Privacy: treat registration code as potentially sensitive; avoid exposing DNI wording; log without raw PII.
- Accessibility-First: UI changes must meet WCAG 2.0 A (aria labels, focus, contrast, toast accessibility).
- Conventional Commits: use `feat(...)`/`fix(...)` format.
- Quality gate: run the targeted backend + `frontend-new` lint/test commands manually; skip `./run-before-merge.sh` to avoid the long aggregate run.
- IaC untouched; no infra drift.
- Outcome: No violations anticipated; re-check after design to ensure frontend-new only and privacy mitigations stand.

## Project Structure

### Documentation (this feature)

```text
specs/001-invite-code-tracking/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md (later via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── invitations/        # invitation repo/types/routes used for code validation and legacy shared flows
│   ├── users/              # user data/profile where registration code will be stored
│   ├── conversations/      # unchanged
│   └── middleware/         # auth/context as needed
└── tests/                  # backend tests

frontend-new/
├── src/
│   ├── pages/              # registration and report routes
│   ├── components/         # form fields, toast, loaders
│   ├── services/           # API clients, analytics/data layer push
│   └── state/              # auth/registration state handling
└── test/                   # frontend tests
```

**Structure Decision**: Web application spanning backend and `frontend-new`; legacy invitation validation remains for manual flows, while secure-link validation now hinges on token + claimed-code checks; no new projects introduced.

## Complexity Tracking

None at this stage; no constitution violations expected.
