# Research: Map Skills to Parent Level

## Decision 1: Use `skillId` (SkillEntity.id) as the primary lookup key

**Decision**: Store and resolve mappings by the child skill’s `skillId` (ObjectId string) and use `SkillEntity.id` at runtime.

**Rationale**: The provided CSV exposes `ID` and `PARENTID` as 24‑char hex values that align with `skillId` in taxonomy collections. Using `skillId` avoids parsing `UUIDHISTORY` and matches the identifiers already present on `SkillEntity` objects in the backend.

**Alternatives considered**:
- Use `UUID` or `originUUID` as lookup keys. Rejected because the CSV does not include a single definitive UUID column (only `UUIDHISTORY`), and mapping to current UUIDs would require additional parsing and ambiguity handling.

## Decision 2: Store the mapping in the taxonomy MongoDB

**Decision**: Persist mappings in a dedicated taxonomy collection (e.g., `skill_parent_mappings`) and treat it as taxonomy data.

**Rationale**: The mapping is derived from taxonomy structure, not user data. Storing it alongside taxonomy reduces cross‑DB coupling and keeps application state untouched.

**Alternatives considered**:
- Store in application DB. Rejected because this is not per‑user or conversation data.
- Read directly from a CSV at runtime. Rejected due to deployment coupling and slower request processing.

## Decision 3: Apply mapping at response serialization only

**Decision**: Map `preferredLabel` (and optionally parent metadata) during response serialization without mutating stored `SkillEntity` objects.

**Rationale**: This keeps extraction, ranking, and storage unchanged while presenting a higher‑level label to users. It avoids altering `originUUID`/ranking behavior, satisfying the “minimal change” requirement.

**Alternatives considered**:
- Replacing stored skills with parent skills. Rejected because it would impact ranking and downstream logic.
- Modifying LLM extraction to return parents directly. Rejected as over‑engineering and higher risk.

## Decision 4: Cache mapping in memory for performance

**Decision**: Load the mapping once at startup (or first use) into an in‑memory dict and use constant‑time lookups in request paths.

**Rationale**: Users are already sensitive to latency; avoiding per‑request DB calls ensures the mapping adds near‑zero overhead.

**Alternatives considered**:
- Query MongoDB for each skill. Rejected due to latency and load.
