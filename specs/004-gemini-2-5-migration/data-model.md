# Data Model: Gemini 2.5 Model Migration

## Entities

### ModelVariant
- **Fields**:
  - `name` (enum): `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`
  - `usage_profile` (enum): `fast`, `deep_reasoning`, `ultra_reasoning`
- **Relationships**:
  - Used by `UsageContext` and `MigrationConfiguration`
- **Validation**:
  - Must be one of the supported Gemini 2.5 model identifiers

### UsageContext
- **Fields**:
  - `name` (string): e.g., `interactive`, `background`, `evaluation`
  - `default_variant` (ModelVariant)
  - `override_variant` (ModelVariant, optional)
- **Relationships**:
  - References `ModelVariant`
- **Validation**:
  - `override_variant` must be a valid `ModelVariant` when set

### MigrationConfiguration
- **Fields**:
  - `enabled` (bool)
  - `default_variant` (ModelVariant)
  - `contexts` (list of UsageContext)
- **Relationships**:
  - Aggregates `UsageContext`
- **Validation**:
  - When `enabled`, `default_variant` must be set

### StructuredResponseContract
- **Fields**:
  - `model_type` (string): Pydantic model name
  - `response_schema` (json)
  - `response_mime_type` (string): `application/json`
- **Relationships**:
  - Applied to LLM calls that require machine-readable output
- **Validation**:
  - `response_schema` must be compatible with Vertex AI schema constraints

### ChangeSummary
- **Fields**:
  - `source` (string): PR reference
  - `files_changed` (list of string)
  - `applies_to_fork` (bool)
  - `notes` (string)
- **Relationships**:
  - References upstream changes mapped to fork code paths
- **Validation**:
  - `source` must be a valid PR URL
