# Change Summary: PR 658 → Fork Mapping

**Source PR**: https://github.com/tabiya-tech/compass/pull/658/changes

## Mapping Table

| Upstream File | Fork Counterpart | Apply? | Notes |
|---|---|---|---|
| backend/app/agent/agent_director/_llm_router.py | same path | yes | Applied AgentsConfig usage + response schema + prompt note. |
| backend/app/agent/collect_experiences_agent/_conversation_llm.py | same path | yes | Updated model selection + END_OF_* markers + focus rules. |
| backend/app/agent/collect_experiences_agent/_dataextraction_llm.py | same path | yes | Added index validation for update ops. |
| backend/app/agent/collect_experiences_agent/data_extraction_llm/_common.py | same path | yes | Normalized "None" string handling. |
| backend/app/agent/collect_experiences_agent/data_extraction_llm/_entity_extraction_tool.py | same path | yes | Added response schema + prompt clarifications + association guidance update. |
| backend/app/agent/collect_experiences_agent/data_extraction_llm/_intent_analyzer_tool.py | same path | yes | Added response schema + prompt clarifications + association guidance update. |
| backend/app/agent/collect_experiences_agent/data_extraction_llm/_temporal_classifier_tool.py | same path | yes | Added response schema + locale date rules + association guidance update. |
| backend/app/agent/config.py | same path | yes | Added centralized model config. |
| backend/app/agent/readme.md | same path | no | Upstream doc change not required for fork; existing doc retained. |
| backend/app/agent/simple_llm_agent/simple_llm_agent.py | same path | yes | Added response schema to default config. |
| backend/app/agent/skill_explorer_agent/_responsibilities_extraction_llm.py | same path | yes | Added response schema. |
| backend/app/agent/skill_explorer_agent/_sentence_decomposition_llm.py | same path | yes | Updated prompt style + response schema. |
| backend/app/agent/experience/_experience_summarizer.py | same path | yes | Added response schema for summarizer output. |
| backend/app/agent/linking_and_ranking_pipeline/cluster_responsibilities_tool/cluster_responsibilties_tool.py | same path | yes | Added response schema for clustering output. |
| backend/app/agent/linking_and_ranking_pipeline/infer_occupation_tool/_contextualization_llm.py | same path | yes | Added response schema for contextualization output. |
| backend/app/agent/linking_and_ranking_pipeline/relevant_entities_classifier_llm.py | same path | yes | Switched classifier to deep reasoning model. |
| backend/app/agent/welcome_agent.py | same path | yes | Added response schema + error handling + instruction updates. |
| backend/app/conversation_memory/summarizer.py | same path | yes | Increased temperature config for summarization. |
| backend/common_libs/llm/_pyd.py | same path | no | File not present in fork; skipped. |
| backend/common_libs/llm/generative_models.py | same path | yes | Ensured response schema handling. |
| backend/common_libs/llm/models_utils.py | same path | yes | Default model set via AgentsConfig. |
| backend/common_libs/llm/sanitize_schema_for_vertex.py | same path | yes | Added sanitizer helper. |
| backend/common_libs/llm/schema_builder.py | same path | yes | Added schema builder. |
| backend/common_libs/agent/translation_tool.py | not present | no | Translation tool not present in fork; skipped. |
| backend/common_libs/llm/try_genai_sdk.py | same path | no | File not present in fork; skipped. |
| backend/evaluation_tests/agent_director/llm_agent_director_scripted_user_test.py | same path | yes | Updated evaluation model markers + locale handling. |
| backend/evaluation_tests/agent_director/llm_router_test.py | same path | yes | Updated expected agent type. |
| backend/evaluation_tests/collect_experiences_agent/_data_extraction_llm_es_test.py | same path | yes | Updated expectations and model marker. |
| backend/evaluation_tests/collect_experiences_agent/_data_extraction_llm_test.py | same path | yes | Updated locale date format expectations. |
| backend/evaluation_tests/collect_experiences_agent/collect_experiences_agent_simulated_user_test.py | same path | yes | Updated evaluation marker. |
| backend/evaluation_tests/collect_experiences_agent/collect_experiences_test_cases.py | same path | yes | Updated month/year expectations. |
| backend/evaluation_tests/collect_experiences_agent/data_extraction/entity_extraction_tool_test.py | same path | yes | Updated evaluation marker. |
| backend/evaluation_tests/collect_experiences_agent/data_extraction/intent_analyzer_llm_test.py | same path | yes | Updated evaluation marker. |
| backend/evaluation_tests/collect_experiences_agent/data_extraction/temporal_classifier_test.py | same path | yes | Updated locale month/year expectations and marker. |
| backend/evaluation_tests/conversation_libs/conversation_test_function.py | same path | yes | Default deep reasoning model. |
| backend/evaluation_tests/core_e2e_tests_cases.py | same path | yes | Updated locale expectations for present values. |
| backend/evaluation_tests/cv_parser/test_cv_parser.py | same path | yes | Adjusted evaluation marker to gemini-2.5-flash-lite. |
| backend/evaluation_tests/cv_parser/test_parse_cv_on_files.py | same path | yes | Switched to repeat marker for real-file CV tests. |
| backend/evaluation_tests/experience_summarizer/experience_summarizer_evaluator.py | same path | yes | Used AgentsConfig + response schema. |
| backend/evaluation_tests/experiences_discovered_evaluator.py | same path | yes | Used AgentsConfig + response schema. |
| backend/evaluation_tests/linking_and_ranking_pipeline/infer_occupation_tool/_relevant_occupations_classifier_llm_test.py | same path | yes | Set locale before execution. |
| backend/evaluation_tests/linking_and_ranking_pipeline/infer_occupation_tool/infer_occupation_tool_test.py | same path | yes | Set locale before execution. |
| backend/evaluation_tests/linking_and_ranking_pipeline/infer_occupation_tool/infer_occupation_tool_test_cases.jsonl | same path | yes | Cleared skip_force entries. |
| backend/evaluation_tests/linking_and_ranking_pipeline/skill_linking/_relevant_skills_classifier_llm_test.py | same path | yes | Set locale before execution. |
| backend/evaluation_tests/linking_and_ranking_pipeline/skill_linking/skills_linking_tool_test.py | same path | yes | Set locale and corrected occupation label access. |
| backend/evaluation_tests/summarizer/summarizer_test.py | same path | yes | Updated model selection + markers. |
| backend/evaluation_tests/test_schema_builder.py | same path | yes | Added schema builder tests. |
| backend/evaluation_tests/translation_tool_test.py | not present | no | Translation tool tests not present in fork; skipped. |
| backend/evaluation_tests/welcome_agent/welcome_agent_scripted_user_test.py | same path | yes | Updated Argentina scripted cases and marker. |
| backend/evaluation_tests/welcome_agent/welcome_agent_simulated_user_test.py | same path | yes | Updated evaluation marker. |

## Notes
- Applied items completed; skipped items are missing or not needed in the fork.
