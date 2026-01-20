# Feature Specification: Map Skills to Parent Level

**Feature Branch**: `001-map-skill-parent`  
**Created**: 2026-01-19  
**Status**: Draft  
**Input**: User description: "Map extracted skills to one-level-up parent using provided CSV (last 3 columns) to reduce granularity while keeping current flow simple."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - See simplified skills (Priority: P1)

As a user viewing extracted skills, I want to see a single parent-level skill for each extracted skill so the results are less granular and easier to understand.

**Why this priority**: This is the core user complaint and directly improves clarity of the main output.

**Independent Test**: Can be fully tested by submitting a skill set with known mappings and confirming the displayed skills are the mapped parent labels.

**Acceptance Scenarios**:

1. **Given** extracted skills that exist in the mapping file, **When** results are displayed, **Then** each skill is shown as its mapped parent label.
2. **Given** multiple extracted skills that map to different parents, **When** results are displayed, **Then** each skill is shown under its respective mapped parent label.
3. **Given** a conversation summary listing “skills found,” **When** the summary is rendered, **Then** parent labels are shown wherever a mapping exists.
4. **Given** multiple child skills that map to the same parent, **When** any user-facing list (drawer, report, chat summary) is shown, **Then** each parent skill appears only once.

---

### User Story 2 - Deterministic mapping (Priority: P2)

As a product owner, I want each extracted skill to map to exactly one parent so the output is consistent and avoids confusion from multiple parents.

**Why this priority**: Ensures predictable outputs and aligns with the provided mapping logic.

**Independent Test**: Can be fully tested by using a sample that includes skills with multiple parents in the source taxonomy and confirming only one mapped parent is shown.

**Acceptance Scenarios**:

1. **Given** a skill that has multiple possible parents in the source taxonomy, **When** it is mapped using the provided file, **Then** exactly one parent is shown in the output.

---

### User Story 3 - Graceful fallback (Priority: P3)

As a user, I want results to still show a skill even if it is not in the mapping file so I do not lose information.

**Why this priority**: Ensures the system remains useful even when mappings are incomplete.

**Independent Test**: Can be fully tested by submitting a skill that is not present in the mapping file and verifying it is still displayed.

**Acceptance Scenarios**:

1. **Given** an extracted skill that does not exist in the mapping file, **When** results are displayed, **Then** the original skill label is shown.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Mapping file contains duplicate entries for a child skill.
- Mapping file is missing or empty at runtime.
- Extracted skill identifier does not match any mapping entry.

### Scope

**In scope**:

- Replace displayed skills with their mapped parent labels using the provided mapping file.
- Preserve current skill extraction behavior while changing only the displayed level.

**Out of scope**:

- Changing how skills are extracted or ranked.
- Redefining the parent-selection methodology already encoded in the mapping file.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST map each extracted skill to exactly one parent skill using the stored mapping (derived from the provided CSV’s last 3 columns).
- **FR-002**: System MUST display the mapped parent skill label in place of the extracted skill label when a mapping exists.
- **FR-003**: System MUST keep and display the original extracted skill when no mapping exists.
- **FR-004**: System MUST apply the same mapping rules consistently across all skill outputs in the current flow, including chat summaries.
- **FR-005**: System MUST de-duplicate displayed skills after mapping so each parent label appears only once per response or summary.

### Key Entities *(include if feature involves data)*

- **Skill**: An extracted skill with an identifier and label.
- **Parent Skill Mapping**: A mapping entry that links a child skill identifier to a single parent identifier, type, and label.

### Assumptions

- The stored MongoDB mapping in the application database is the runtime source of truth and already encodes the multi-parent resolution from the CSV.
- The mapping covers the majority of extracted skills; unmapped skills are acceptable and should pass through unchanged.
- The mapping uses identifiers that match the identifiers produced by the current skill extraction flow.

### Dependencies

- Availability of the mapping collection in the application MongoDB (populated via the loader script).

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 100% of skills found in the mapping file are displayed as their mapped parent in user-facing outputs.
- **SC-002**: 95% of requests that return skills show results within 1 second of the current baseline response time.
- **SC-003**: At least 80% of user feedback rates the skill granularity as “appropriate” after release.
- **SC-004**: Support tickets or feedback mentioning “too granular skills” drop by at least 50% within 30 days of release.
