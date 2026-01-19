# Implementation Plan: GA4 Registration Code Tracking

**Branch**: `001-ga4-registration-tracking` | **Date**: 2026-01-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-ga4-registration-tracking/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Use GA4 `user_id` to carry the secure-link `registration_code` for invited users; legacy manual-invite users continue using internal `user_id`. Frontend-new captures `registration_code` from the secure link at first visit, stores it for the session, and on login pushes it via dataLayer so GTM can set GA4 config `user_id`. On subsequent logins (no secure link), the client sets `user_id` from the authenticated user profile, not from the URL. GA4 User-ID is enabled; exports to BigQuery rely on the same `user_id` column for journey reconstruction. No backend or IaC changes expected if the user profile already exposes `registration_code`.

## Technical Context

**Language/Version**: TypeScript/React (frontend-new), GTM/GA4 config; Python backend untouched unless identifier exposure needed (not expected).  
**Primary Dependencies**: React/Next tooling in `frontend-new`, Google Tag Manager, GA4 dataLayer, existing custom events.  
**Storage**: Browser sessionStorage/local state for registration_code during session; GA4/BigQuery for analytics data; user profile as source of truth for subsequent sessions.  
**Testing**: `yarn test`, `yarn lint`, GA4 DebugView/Realtime verification; no backend tests expected.  
**Target Platform**: Web (frontend-new).  
**Project Type**: Web app with GTM/GA4 instrumentation.  
**Performance Goals**: Minimal overhead; analytics pushes must not block UI.  
**Constraints**: No PII in analytics payloads; avoid persisting registration_code beyond session where not needed; keep legacy tracking unchanged.  
**Scale/Scope**: Limited to analytics identifier plumbing; no schema migrations or new services.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
- **Monorepo scope**: Work limited to `frontend-new/` instrumentation and GTM/GA4 configs; no backend or iac changes planned.
- **IaC discipline**: No infra changes expected; if GA/BigQuery config needs notes, document, do not change manually in codebase.
- **Security & Privacy**: No PII added to analytics; only `registration_code` or internal `user_id` as identifiers; avoid storing sensitive data client-side beyond session.
- **Accessibility**: UI impact minimal (analytics hooks); ensure any UI touch keeps WCAG A; run targeted `yarn lint`/tests if UI is touched.
- **Environment readiness**: `frontend-new` requires `public/data/env.js` per guide; backend env unchanged. GA4/GTM credentials managed outside repo.
- **Testing & linting**: Run targeted `yarn lint`/`yarn test` for touched modules; use GA4 DebugView for verification. Full `./run-before-merge.sh` unnecessary unless scope widens.
- **Automation hygiene**: Do not create/modify ignore files.
- **Change hygiene**: Branch already `001-ga4-registration-tracking`; use Conventional Commits.

## Project Structure

### Documentation (this feature)

```text
specs/001-ga4-registration-tracking/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
  app/
  tests/

frontend-new/
  src/
    components/
    pages/
    services/
    analytics/ (target location for GA4/GTM helpers)
  public/data/env.js
  tests/
```

**Structure Decision**: Web application split between backend and `frontend-new/`; work is confined to `frontend-new` analytics helpers and documentation in `specs/001-ga4-registration-tracking/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | N/A | N/A |
