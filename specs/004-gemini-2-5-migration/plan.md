# Implementation Plan: Gemini 2.5 Model Migration

**Branch**: `004-gemini-2-5-migration` | **Date**: 21 January 2026 | **Spec**: [specs/004-gemini-2-5-migration/spec.md](specs/004-gemini-2-5-migration/spec.md)
**Input**: Feature specification from `/specs/004-gemini-2-5-migration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Migrate all AI workflows to Gemini 2.5 (flash-lite, flash, pro) using a centralized model configuration, enforce structured outputs with schema-based validation, and align prompt/formatting and locale-sensitive date handling with upstream PR 658 while preserving fork-specific behavior.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.12  
**Primary Dependencies**: FastAPI, Pydantic v2, Vertex AI SDK, Poetry  
**Storage**: MongoDB Atlas  
**Testing**: pytest, pylint, bandit  
**Target Platform**: Linux server  
**Project Type**: web (backend-focused)  
**Performance Goals**: Maintain current latency targets; 95% responses within existing baseline  
**Constraints**: No deprecated model usage; structured outputs ≥99% valid in evaluation runs  
**Scale/Scope**: Existing production scale and workflows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
- **Monorepo scope**: ✅ Backend changes stay under `backend/`; no `frontend/` changes.
- **IaC discipline**: ✅ No infrastructure changes.
- **Security & Privacy**: ✅ No new PII flows; follow existing sensitive data protections.
- **Accessibility**: ✅ No UI changes.
- **Environment readiness**: ✅ Backend env requirements unchanged.
- **Testing & linting**: ✅ Targeted backend evaluation tests will be run.
- **Automation hygiene**: ✅ No ignore file changes planned.
- **Change hygiene**: ✅ Branch and commit conventions maintained.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
backend/
├── app/
│   ├── agent/
│   ├── conversations/
│   ├── users/
│   └── vector_search/
├── common_libs/
│   └── llm/
└── evaluation_tests/

specs/004-gemini-2-5-migration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
```

**Structure Decision**: Web application with backend-focused changes under `backend/`.

## Complexity Tracking

No constitution violations.

## Phase 0: Outline & Research

- Completed research in [specs/004-gemini-2-5-migration/research.md](specs/004-gemini-2-5-migration/research.md).
- All clarifications resolved based on PR 658 and repository context.

## Phase 1: Design & Contracts

- Data model captured in [specs/004-gemini-2-5-migration/data-model.md](specs/004-gemini-2-5-migration/data-model.md).
- Contract defined in [specs/004-gemini-2-5-migration/contracts/llm-config.schema.json](specs/004-gemini-2-5-migration/contracts/llm-config.schema.json).
- Quickstart authored in [specs/004-gemini-2-5-migration/quickstart.md](specs/004-gemini-2-5-migration/quickstart.md).
- Agent context updated via `.specify/scripts/bash/update-agent-context.sh copilot`.

### Constitution Check (Post-Design)

All checks remain satisfied.

## Phase 2: Implementation Planning

1. Compare fork code against PR 658 file list and map applicable changes (models, schema builder, prompt edits, tests).
2. Add centralized model configuration and switch `LLMConfig` default to Gemini 2.5.
3. Introduce schema builder and attach `response_schema` to JSON-producing LLM calls.
4. Update prompts, end markers, and locale-sensitive date handling to match upstream behavior.
5. Update evaluation tests and add schema-builder tests aligned to fork codebase.
