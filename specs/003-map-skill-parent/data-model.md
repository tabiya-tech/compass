# Data Model: Map Skills to Parent Level

## Entity: SkillParentMapping

Represents a one‑to‑one mapping from a child skill to a single parent label (skill or skillgroup).

**Fields**:
- `child_skill_id` (string, required): The taxonomy `skillId` for the child skill.
- `child_uuid` (string, optional): Child skill UUID (if resolved during import).
- `parent_id` (string, required): The parent skill/skillgroup ID from the CSV.
- `parent_label` (string, required): Display label for the parent (from CSV).
- `parent_object_type` (string, required): `skill` | `skillgroup`.
- `updated_at` (datetime, required): Import timestamp.
- `source_file` (string, optional): Filename or version identifier for traceability.

**Indexes**:
- Unique index on `child_skill_id`.
- Optional index on `child_uuid` (if populated) for fallback lookups.

## Relationships

- `SkillParentMapping.child_skill_id` refers to taxonomy skill documents by `skillId`.
- `parent_id` refers to a taxonomy skill or skillgroup ID (as identified in the CSV).

## Storage Location

- Stored in the application MongoDB database for write access, while referencing taxonomy identifiers.

## Validation Rules

- `child_skill_id` and `parent_id` must be non‑empty 24‑char hex strings.
- `parent_label` must be non‑empty.
- `parent_object_type` must be one of `skill`, `skillgroup`.

## State Transitions

- **Import/Replace**: Full delete + bulk insert per CSV update.
