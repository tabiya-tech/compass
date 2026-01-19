# Implementation Plan: Map Skills to Parent Level

**Branch**: `001-map-skill-parent` | **Date**: 2026-01-19 | **Spec**: [specs/001-map-skill-parent/spec.md](specs/001-map-skill-parent/spec.md)
**Input**: Feature specification from `/specs/001-map-skill-parent/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Map extracted skills to a one-level-up parent label using a MongoDB-backed mapping (Option A). A loader script imports the CSV and replaces the mapping collection. The backend applies the mapping only at response serialization, leaving extraction, ranking, and storage unchanged. The mapping is cached in memory to avoid per-request DB calls.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Python 3.11  
**Primary Dependencies**: FastAPI, Motor (MongoDB), Pydantic, Poetry  
**Storage**: MongoDB (taxonomy DB) for `skill_parent_mappings`  
**Testing**: pytest, pylint, bandit  
**Target Platform**: Backend API service (FastAPI)  
**Project Type**: Backend service (monorepo)  
**Performance Goals**: No additional per-request DB calls; O(1) in‑memory lookups; negligible latency impact (<5ms per request).  
**Constraints**: Keep response schema unchanged; avoid modifying extraction/ranking/storage; fallback to original label when unmapped.  
**Scale/Scope**: ~13.9k mappings; dozens of skills per experience response.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
- **Monorepo scope**: PASS — backend-only changes planned.
- **IaC discipline**: PASS — no infra changes.
- **Security & Privacy**: PASS — no PII changes.
- **Accessibility**: PASS — no UI changes.
- **Environment readiness**: PASS — uses existing env setup.
- **Testing & linting**: PASS — backend-only targeted tests.
- **Automation hygiene**: PASS — no ignore file changes.
- **Change hygiene**: PASS — branch naming already compliant.

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
│   ├── conversations/experience/_types.py
│   └── server.py
├── features/
│   └── skills_granularity/
│       ├── skill_parent_mapping_store.py   # new: in‑memory cache + lookup
│       └── skills_with_parent.csv          # provided source (input only)
└── scripts/
   └── skills_parent_mapping/
      └── load_mapping.py                 # new: CSV → MongoDB loader
```

**Structure Decision**: Backend‑only changes under `backend/` with a small feature module and a loader script.

## Phase 0: Outline & Research (complete)

- Resolved mapping key decision (use `skillId`).
- Confirmed MongoDB taxonomy storage with in‑memory cache for performance.
- Confirmed mapping applied at response serialization only.

Artifacts:
- [specs/001-map-skill-parent/research.md](specs/001-map-skill-parent/research.md)

## Phase 1: Design & Contracts (complete)

### Data Model
- [specs/001-map-skill-parent/data-model.md](specs/001-map-skill-parent/data-model.md)

### API Contracts
- [specs/001-map-skill-parent/contracts/experience-skill-mapping.openapi.yaml](specs/001-map-skill-parent/contracts/experience-skill-mapping.openapi.yaml)

### Quickstart
- [specs/001-map-skill-parent/quickstart.md](specs/001-map-skill-parent/quickstart.md)

### Agent Context Update
- Run `.specify/scripts/bash/update-agent-context.sh copilot` (see execution log in this plan).

## Constitution Check (Post‑Design)

PASS — no changes required.

## Phase 2: Implementation Plan

1. **Create mapping store**
  - Add `skill_parent_mapping_store.py` with:
    - async `initialize()` to load mappings from taxonomy DB into dict.
    - sync `get_parent_label(child_skill_id)` lookup.
    - safe fallback when mappings are missing.

2. **Integrate mapping into responses**
  - Update `convert_skill_entities_to_skills_response` or `SkillResponse.from_skill_entity` to:
    - Use `SkillEntity.id` to lookup mapping.
    - Replace `preferredLabel` with parent label if found.
    - Keep all other fields unchanged to preserve downstream behavior.

3. **Load mapping at startup**
  - Add initialization to `server.py` lifespan/startup to prime cache once.
  - Ensure failures log warnings and continue with fallback behavior.

4. **Add CSV → Mongo loader script**
  - New script under `backend/scripts/skills_parent_mapping/`.
  - Delete existing mappings; insert new records in bulk.
  - Validate required CSV columns; log skipped rows.

5. **Indexes**
  - Ensure unique index on `child_skill_id` is created by the loader.

6. **Tests (targeted)**
  - Minimal unit test for mapping store lookup and fallback.
  - Minimal unit test for experience response mapping (preferredLabel changed only when mapped).

7. **Documentation**
  - Update backend README or script docstring with loader usage.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
