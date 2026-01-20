# Skills Granularity

## Skill Selection Logic (User-Facing)

- Skills are mapped to parent labels when a mapping exists (keyed by child `skillId`).
- After mapping, duplicate parent labels are removed so each parent skill appears only once per list or summary.
- This applies consistently across the experience drawer, skills report, and chat summary text.

## Mapping Location

- Stored in the application MongoDB database.
- Collection name: `skill_parent_mappings`.
- Each document links a child `skillId` to a parent label (and parent metadata).

## How It Works (Summary)

1. **Input skills** are still extracted and ranked as before (child skills from the taxonomy).
2. **Mapping step** replaces each child label with its mapped parent label when available.
3. **Dedup step** removes repeated parent labels so a parent appears once even if multiple children map to it.
4. **Fallback** keeps the original child label if no mapping is found.

## CSV Loading (Source of Truth)

- Load the mapping from a CSV using:
	- `poetry run python scripts/skills_parent_mapping/load_mapping.py --csv /path/to/skills_with_parent.csv`
- Required CSV columns:
	- `ID` (child skill id)
	- `PARENTID`
	- `PARENTOBJECTTYPE`
	- `PARENTLABEL`

## Why This Matters

- Reduces overly granular lists without changing extraction logic.
- Keeps UI outputs consistent across surfaces.
- Avoids confusing repeats when multiple child skills share a parent.
