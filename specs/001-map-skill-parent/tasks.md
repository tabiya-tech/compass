# Tasks: Map Skills to Parent Level

**Input**: Design documents from `/specs/001-map-skill-parent/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Minimal tests added to validate mapping lookup and response label behavior.

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Ensure module init exists in backend/features/skills_granularity/__init__.py

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 Add mapping collection constants in backend/features/skills_granularity/constants.py
- [x] T003 Implement in-memory mapping store in backend/features/skills_granularity/skill_parent_mapping_store.py (cache, initialize, lookup returning parent label)
- [x] T004 [P] Wire mapping store initialization on startup in backend/app/server.py with non-fatal logging on failure

**Checkpoint**: Mapping store available and initialized before any response mapping.

---

## Phase 3: User Story 1 - See simplified skills (Priority: P1) 🎯 MVP

**Goal**: Show parent-level skill labels for mapped skills while leaving extraction/ranking unchanged.

**Independent Test**: Call experiences endpoint with known mapped skills and verify `preferredLabel` shows the parent label.

### Tests (minimal)

- [x] T005 [P] [US1] Add unit test for mapping store lookup/fallback in backend/app/conversations/experience/test_utils.py
- [x] T006 [P] [US1] Add unit test for response label mapping in backend/app/conversations/experience/test_service.py

### Implementation

- [x] T007 [US1] Apply mapping in backend/app/conversations/experience/_types.py so SkillResponse.preferredLabel uses the parent label when mapping exists
- [x] T008 [P] [US1] Update contract docs in specs/001-map-skill-parent/contracts/experience-skill-mapping.openapi.yaml to document mapped label behavior

**Checkpoint**: Mapped labels appear in responses without changing the API shape for existing clients.

---

## Phase 4: User Story 2 - Deterministic mapping (Priority: P2)

**Goal**: Provide a deterministic, replaceable mapping source via MongoDB.

**Independent Test**: Run the loader on a CSV and confirm the mapping collection in the application DB contains one entry per child skill.

### Implementation

- [x] T009 [P] [US2] Build CSV loader in backend/scripts/skills_parent_mapping/load_mapping.py to delete/insert mappings and create unique index on child_skill_id
- [x] T010 [US2] Document loader usage in backend/scripts/skills_parent_mapping/load_mapping.py docstring

**Checkpoint**: Mapping collection can be fully replaced by running the loader script.

---

## Phase 5: User Story 3 - Graceful fallback (Priority: P3)

**Goal**: Keep original skill labels when a mapping does not exist.

**Independent Test**: Return an experience with an unmapped skill and verify its label is unchanged.

### Implementation

- [x] T011 [US3] Ensure lookup fallback in backend/features/skills_granularity/skill_parent_mapping_store.py returns None and response mapping keeps original label

**Checkpoint**: Unmapped skills pass through unchanged.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T012 [P] Update specs/001-map-skill-parent/quickstart.md with final loader invocation command

---

## Phase 7: Chat Summary & Dedup (New)

- [x] T013 Apply parent-label mapping to chat experience summaries so “skills found” use parent labels when available
- [x] T014 De-duplicate mapped skills in user-facing outputs (drawer, reports, chat summaries) to show each parent label once
- [x] T015 Add/extend tests to cover chat summary mapping and deduplication behavior

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → **User Story 1 (P1)** → **User Story 2 (P2)** → **User Story 3 (P3)** → **Polish**
- Foundational tasks block all user stories.
- User stories can proceed sequentially after Foundation; US2 and US3 can run after US1 if needed.

## Parallel Execution Examples

### User Story 1
- T006 can be done in parallel with T005.

### User Story 2
- T009 can be started as soon as T002 completes (collection name known).

### User Story 3
- T011 can be done in parallel with any doc updates once T003 exists.

## Implementation Strategy

- **MVP scope**: Phase 1–3 (US1) only.
- Validate mapped labels in API responses before moving to US2/US3.
- Keep performance impact minimal by using the in-memory cache and avoiding per-request DB calls.
