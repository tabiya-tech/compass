# Quickstart: Gemini 2.5 Model Migration

## Goal
Apply the upstream migration pattern from PR 658 to the fork, aligning model selection and structured output enforcement while preserving fork-specific behavior.

## Steps
1. Identify all LLM call sites in `backend/app/agent/**` and `backend/common_libs/llm/**` that currently rely on deprecated model defaults.
2. Introduce a centralized model configuration (`AgentsConfig`) and route defaults through `LLMConfig`.
3. Use Gemini 2.5 variants per usage context (flash-lite for fast evals, flash for deep reasoning, pro for ultra reasoning).
4. Add schema-based response enforcement for JSON outputs using a shared schema builder.
5. Update prompts and markers to match upstream wording and behaviors where applicable.
6. Align locale-sensitive date formatting logic and corresponding tests (month/year formats).
7. Produce a change summary mapping upstream PR files to fork-specific equivalents.

## Validation
- Run targeted evaluation tests in `backend/evaluation_tests/**` that were updated upstream.
- Ensure evaluation markers reference Gemini 2.5 names (e.g., `gemini-2.5-flash-lite/`, `gemini-2.5-pro/`).
- Ensure structured response validation is enabled for LLMs that output JSON.
