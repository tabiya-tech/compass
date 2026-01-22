# Research: Gemini 2.5 Model Migration

## Decisions

### 1) Model family and default selection
- **Decision**: Adopt Gemini 2.5 models with defaults aligned to `flash-lite` for fast/low-reasoning and `flash` for deep reasoning; reserve `pro` for ultra-high reasoning.
- **Rationale**: Matches upstream PR guidance and keeps latency and cost aligned with current usage tiers.
- **Alternatives considered**: Keeping `gemini-2.0-flash-001` as default; rejected due to deprecation risk.

### 2) Centralized model configuration
- **Decision**: Introduce a single source of truth for model names (e.g., `AgentsConfig`) and have `LLMConfig` default to that value.
- **Rationale**: Prevents drift across agents and simplifies overrides per agent/usage context.
- **Alternatives considered**: Per-agent hard-coded model names; rejected due to maintenance risk.

### 3) Structured response enforcement
- **Decision**: Add a schema builder and attach response schemas for machine-readable outputs via `response_mime_type` + `response_schema`.
- **Rationale**: PR 658 notes `flash-lite` can struggle with JSON; schema enforcement increases reliability.
- **Alternatives considered**: Rely on prompt-only JSON instructions; rejected due to lower determinism.

### 4) Locale-safe date handling
- **Decision**: Preserve user locale formats and avoid inventing missing date precision (e.g., month/year only).
- **Rationale**: PR 658 adjusts temporal classifier rules and tests to reflect locale-specific formats.
- **Alternatives considered**: Normalize all dates to a fixed format; rejected as it would change user-visible behavior.

### 5) Prompt and token markers alignment
- **Decision**: Update prompt instructions and markers to match upstream (`END_OF_WORKTYPE`, `END_OF_CONVERSATION`) and reinforce focus.
- **Rationale**: Aligns with upstream agent behavior changes and improves routing clarity.
- **Alternatives considered**: Keep legacy markers; rejected due to inconsistency with upstream and tests.

### 6) Fork-specific alignment strategy
- **Decision**: Use PR 658 as baseline and apply only deltas that match fork-specific code paths, documenting exclusions.
- **Rationale**: Fork has divergences; applying changes blindly risks regressions.
- **Alternatives considered**: Cherry-pick whole PR; rejected due to fork differences.
