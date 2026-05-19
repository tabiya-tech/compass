# Job-demand Sector filter — mapping decision

## Decision
The Sector filter on the "Top Skills In Demand (Job Postings)" chart maps the
institution-sector dropdown value to job-posting `category` values via a
**generated** artifact, `sector_category_map.json`.

## Why
- The dropdown vocabulary is the authoritative TEVETA sector list
  (`teveta-master.json` → `institutions[].sectors`, via
  `app.teveta.loader.get_institution_sectors`).
- Job postings have **no sector field**. Only a free-text, job-board
  `category` exists, and there is **no authoritative `category → sector`
  crosswalk** anywhere (we checked: `teveta-master.json` `critical_skills`/
  `priority_curriculum` cover only ~7 sectors and don't join to job ESCO
  occupations — see commit discussion).
- A hand-maintained Python dict rots silently as categories drift. So the
  crosswalk is **generated, not hand-typed**: an LLM classifies the *live*
  distinct `category` leading tokens into the authoritative sectors. The
  artifact is data (reviewable, diffable) and regenerable on demand.
- Leading-token semantics: only the part of `category` before the first comma
  is matched; unmapped/junk tokens (`Other`, `Remote`, locations…) are `null`
  and excluded when a sector is selected. Coverage is recorded in `_meta`.

## Regenerate
```bash
cd backend   # JOBS_* env + Vertex creds; GOOGLE_CLOUD_PROJECT - njila project
poetry run python -m app.analytics.job_demand.generate_sector_category_map
```
One Gemini call; rerun when the `category` distribution changes. The consumer
(`sector_mapping.py`) only reads the artifact.

## Future fix (remove the approximation)
The durable fix is to stop inferring sector from free-text `category`:
have the upstream classification/matching pipeline write a **normalized
sector onto each job at ingestion** (e.g. from the job's ESCO occupation via a
maintained ESCO→sector table). Then this filter becomes an exact `$match` on
that field.

When upstream provides `job.sector`, this whole approximation collapses:

- **Delete**: `generate_sector_category_map.py`, `sector_category_map.json`,
  `sector_mapping.py`, `test_sector_mapping.py`, and this `SECTOR_MAPPING.md`.
- **Simplify** `repository.py`: drop the `job_category_match` import; replace
  the sector branch in `base_match` with `base_match["sector"] = sector`.
- **Rewrite** `test_repository.py::TestSectorFilter`: drop the
  `_fixed_sector_map` monkeypatch; seed jobs with a `sector` field instead.
- **Keep** `app.teveta.loader.get_institution_sectors()` (authoritative sector
  vocabulary, independent of this mapping) — remove only if otherwise unused.
- **Unchanged**: the route, the API contract, and the entire frontend (they
  already just pass `sector` through).
