# Quickstart: Map Skills to Parent Level

## Prerequisites

- Backend environment configured (see backend/README.md).
- Access to application MongoDB.
- CSV file with columns: `ID`, `PARENTID`, `PARENTOBJECTTYPE`, `PARENTLABEL`.

## Load/Replace the Mapping

1. Place the CSV file in a local path accessible to the backend.
2. Run the loader script:
  - `poetry run python scripts/skills_parent_mapping/load_mapping.py --csv /path/to/skills_with_parent.csv`
   - The script deletes existing mappings and inserts the new set.
   - The output reports the number of mappings inserted and any skipped rows.

## Verify

- Fetch experiences via `GET /conversations/{session_id}/experiences` and confirm:
  - Skills included in the mapping show the parent `preferredLabel`.
  - Skills not in the mapping show the original `preferredLabel`.

## Rollback

- Re-run the loader with a previous CSV or restore the collection from backup.
