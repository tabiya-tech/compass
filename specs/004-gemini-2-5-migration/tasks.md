# Tasks: Gemini 2.5 Model Migration

**Input**: Design documents from `/specs/004-gemini-2-5-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Inventory PR 658 file list and map fork counterparts in specs/004-gemini-2-5-migration/change-summary.md

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 Add centralized model configuration in backend/app/agent/config.py
- [x] T003 Update default model selection to AgentsConfig.default_model in backend/common_libs/llm/models_utils.py
- [x] T004 Add Vertex-compatible schema builder utilities in backend/common_libs/llm/schema_builder.py
- [x] T005 Add schema sanitization helper in backend/common_libs/llm/sanitize_schema_for_vertex.py
- [x] T006 Ensure GeminiGenerativeLLM passes response schema safely in backend/common_libs/llm/generative_models.py
- [x] T007 Add schema builder validation tests in backend/evaluation_tests/test_schema_builder.py

---

## Phase 3: User Story 1 - Keep AI responses running on supported models (Priority: P1)

**Goal**: All AI flows run on Gemini 2.5 with structured output enforcement and aligned prompts.

**Independent Test**: Core AI flows complete without using deprecated models and JSON responses validate against schema.

### Implementation for User Story 1

- [x] T008 [P] [US1] Apply deep-reasoning model + response schema to router in backend/app/agent/agent_director/_llm_router.py
- [x] T009 [P] [US1] Update collect experiences conversation LLM markers and model selection in backend/app/agent/collect_experiences_agent/_conversation_llm.py
- [x] T010 [P] [US1] Add update index validation in backend/app/agent/collect_experiences_agent/_dataextraction_llm.py
- [x] T011 [P] [US1] Normalize "None" handling in backend/app/agent/collect_experiences_agent/data_extraction_llm/_common.py
- [x] T012 [P] [US1] Apply response schema + prompt clarifications in backend/app/agent/collect_experiences_agent/data_extraction_llm/_entity_extraction_tool.py
- [x] T013 [P] [US1] Apply response schema + prompt clarifications in backend/app/agent/collect_experiences_agent/data_extraction_llm/_intent_analyzer_tool.py
- [x] T014 [P] [US1] Apply response schema + locale date rules in backend/app/agent/collect_experiences_agent/data_extraction_llm/_temporal_classifier_tool.py
- [x] T015 [P] [US1] Add response schema to SimpleLLMAgent defaults in backend/app/agent/simple_llm_agent/simple_llm_agent.py
- [x] T016 [P] [US1] Add response schema to responsibilities extraction in backend/app/agent/skill_explorer_agent/_responsibilities_extraction_llm.py
- [x] T017 [P] [US1] Update sentence decomposition prompts and schemas in backend/app/agent/skill_explorer_agent/_sentence_decomposition_llm.py
- [x] T018 [P] [US1] Add response schema for welcome agent outputs in backend/app/agent/welcome_agent.py
- [x] T038 [P] [US1] Align associations guidance example + max-steps note in backend/app/agent/collect_experiences_agent/data_extraction_llm/_entity_extraction_tool.py
- [x] T039 [P] [US1] Align associations guidance example + max-steps note in backend/app/agent/collect_experiences_agent/data_extraction_llm/_intent_analyzer_tool.py
- [x] T040 [P] [US1] Align temporal classifier schema defaults and associations guidance in backend/app/agent/collect_experiences_agent/data_extraction_llm/_temporal_classifier_tool.py
- [x] T041 [P] [US1] Add response schema to experience summarizer LLM in backend/app/agent/experience/_experience_summarizer.py
- [x] T042 [P] [US1] Add response schema to cluster responsibilities tool in backend/app/agent/linking_and_ranking_pipeline/cluster_responsibilities_tool/cluster_responsibilties_tool.py
- [x] T043 [P] [US1] Add response schema to contextualization LLM in backend/app/agent/linking_and_ranking_pipeline/infer_occupation_tool/_contextualization_llm.py
- [x] T044 [P] [US1] Use deep-reasoning model in relevant entities classifier in backend/app/agent/linking_and_ranking_pipeline/relevant_entities_classifier_llm.py
- [x] T045 [P] [US1] Update conversation summarizer LLM config to HIGH_TEMPERATURE_GENERATION_CONFIG in backend/app/conversation_memory/summarizer.py
- [x] T046 [P] [US1] Apply response schema to translation tool in backend/common_libs/agent/translation_tool.py
- [x] T047 [P] [US1] Align welcome agent error handling and instruction updates in backend/app/agent/welcome_agent.py

---

## Phase 4: User Story 2 - Choose the right Gemini 2.5 variant for each usage (Priority: P2)

**Goal**: Configure flash-lite/flash/pro variants by usage context across agents and evaluators.

**Independent Test**: Each usage context routes to the expected Gemini 2.5 variant without altering user-visible behavior.

### Implementation for User Story 2

- [x] T019 [P] [US2] Apply ultra-high reasoning model + schema for summarizer evaluation in backend/evaluation_tests/experience_summarizer/experience_summarizer_evaluator.py
- [x] T020 [P] [US2] Apply deep reasoning model + schema for experience discovery evaluator in backend/evaluation_tests/experiences_discovered_evaluator.py
- [x] T021 [P] [US2] Set simulated user default model to deep reasoning in backend/evaluation_tests/conversation_libs/conversation_test_function.py
- [x] T022 [P] [US2] Align evaluation model markers for agent director tests in backend/evaluation_tests/agent_director/llm_agent_director_scripted_user_test.py
- [x] T023 [P] [US2] Align router expectation for model shift in backend/evaluation_tests/agent_director/llm_router_test.py
- [x] T024 [P] [US2] Update collect experiences evaluation expectations in backend/evaluation_tests/collect_experiences_agent/_data_extraction_llm_test.py
- [x] T025 [P] [US2] Update ES locale data extraction expectations in backend/evaluation_tests/collect_experiences_agent/_data_extraction_llm_es_test.py
- [x] T026 [P] [US2] Update collect experiences test cases in backend/evaluation_tests/collect_experiences_agent/collect_experiences_test_cases.py
- [x] T027 [P] [US2] Update entity extraction tests in backend/evaluation_tests/collect_experiences_agent/data_extraction/entity_extraction_tool_test.py
- [x] T028 [P] [US2] Update intent analyzer tests in backend/evaluation_tests/collect_experiences_agent/data_extraction/intent_analyzer_llm_test.py
- [x] T029 [P] [US2] Update temporal classifier tests for locale formats in backend/evaluation_tests/collect_experiences_agent/data_extraction/temporal_classifier_test.py
- [x] T030 [P] [US2] Update simulated user test fixtures in backend/evaluation_tests/collect_experiences_agent/collect_experiences_agent_simulated_user_test.py
- [x] T031 [P] [US2] Update E2E evaluation cases for locale behavior in backend/evaluation_tests/core_e2e_tests_cases.py
- [x] T032 [P] [US2] Align CV parser evaluation marker in backend/evaluation_tests/cv_parser/test_cv_parser.py
- [x] T033 [P] [US2] Update summarizer evaluator model in backend/evaluation_tests/summarizer/summarizer_test.py
- [x] T048 [P] [US2] Align CV parser evaluation marker to gemini-2.5-flash-lite in backend/evaluation_tests/cv_parser/test_cv_parser.py
- [x] T049 [P] [US2] Update CV parser real-file test repeat behavior in backend/evaluation_tests/cv_parser/test_parse_cv_on_files.py
- [x] T050 [P] [US2] Set locale for relevant occupations classifier tests in backend/evaluation_tests/linking_and_ranking_pipeline/infer_occupation_tool/_relevant_occupations_classifier_llm_test.py
- [x] T051 [P] [US2] Set locale for infer occupation tool tests in backend/evaluation_tests/linking_and_ranking_pipeline/infer_occupation_tool/infer_occupation_tool_test.py
- [x] T052 [P] [US2] Set locale for relevant skills classifier tests in backend/evaluation_tests/linking_and_ranking_pipeline/skill_linking/_relevant_skills_classifier_llm_test.py
- [x] T053 [P] [US2] Update skill linking tool test locale setup and occupation label usage in backend/evaluation_tests/linking_and_ranking_pipeline/skill_linking/skills_linking_tool_test.py
- [x] T054 [P] [US2] Update welcome agent scripted user cases and markers in backend/evaluation_tests/welcome_agent/welcome_agent_scripted_user_test.py
- [x] T055 [P] [US2] Update welcome agent simulated user marker in backend/evaluation_tests/welcome_agent/welcome_agent_simulated_user_test.py
- [x] T056 [P] [US2] Update translation tool evaluation marker in backend/evaluation_tests/translation_tool_test.py
- [x] T057 [P] [US2] Refresh infer occupation tool JSONL fixtures in backend/evaluation_tests/linking_and_ranking_pipeline/infer_occupation_tool/infer_occupation_tool_test_cases.jsonl

---

## Phase 5: User Story 3 - Review fork-specific migration changes (Priority: P3)

**Goal**: Produce a fork-aware migration change summary based on PR 658.

**Independent Test**: The change summary maps each PR 658 file to fork equivalents and clearly marks apply/exclude decisions.

### Implementation for User Story 3

- [x] T034 [US3] Finalize change summary with applied/excluded items in specs/004-gemini-2-5-migration/change-summary.md
- [x] T035 [P] [US3] Decide on upstream helper scripts in backend/common_libs/llm/_pyd.py and backend/common_libs/llm/try_genai_sdk.py, document decision in specs/004-gemini-2-5-migration/change-summary.md
- [x] T036 [P] [US3] Add or update agents overview doc in backend/app/agent/readme.md (if needed for fork), and record in specs/004-gemini-2-5-migration/change-summary.md
- [x] T058 [US3] Update change summary for commit 251edc7 additions/removals in specs/004-gemini-2-5-migration/change-summary.md

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T037 [P] Update migration notes and quickstart references in specs/004-gemini-2-5-migration/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → **US1/US2/US3** → **Polish**
- Foundational tasks block all user stories.

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 completion.
- **US2 (P2)**: Depends on Phase 2 completion; can run in parallel with US1.
- **US3 (P3)**: Can start after Phase 1 but should be finalized after US1/US2 changes.

### Parallel Opportunities

- US1 tasks T008–T018 can run in parallel across different files.
- US2 tasks T019–T033 can run in parallel across different test files.
- US3 tasks T035–T036 can run in parallel once the change summary template exists.

---

## Parallel Example: User Story 1

- Task: T008 Apply deep-reasoning model + response schema to router in backend/app/agent/agent_director/_llm_router.py
- Task: T012 Apply response schema + prompt clarifications in backend/app/agent/collect_experiences_agent/data_extraction_llm/_entity_extraction_tool.py
- Task: T017 Update sentence decomposition prompts and schemas in backend/app/agent/skill_explorer_agent/_sentence_decomposition_llm.py

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 tasks T008–T018.
3. Validate core AI flows against Gemini 2.5 with structured outputs.

### Incremental Delivery

1. Add US2 evaluation updates to reflect model variants and locale changes.
2. Finalize US3 change summary for fork alignment.
3. Apply polish updates to quickstart documentation.
