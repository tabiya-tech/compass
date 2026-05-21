"""
Regenerate ``sector_category_map.json`` for the job-demand Sector filter.

No authoritative ``job.category -> sector`` crosswalk exists; this LLM-classifies
the live distinct ``job.category`` leading tokens into the authoritative TEVETA
sectors. Re-run when the category distribution drifts. See SECTOR_MAPPING.md.

Usage (from backend/, JOBS_* env + Vertex creds, correct GOOGLE_CLOUD_PROJECT):
    poetry run python -m app.analytics.job_demand.generate_sector_category_map
"""
import argparse
import asyncio
import collections
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

from app.analytics.job_demand.sector_mapping import category_leading_token
from app.teveta.loader import get_institution_sectors
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import JSON_GENERATION_CONFIG, LLMConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_OUT_PATH = Path(__file__).parent / "sector_category_map.json"

_SYSTEM = (
    "You map noisy job-board category labels to a FIXED economic-sector "
    "taxonomy. For each input category you return exactly one sector from the "
    "allowed list, or null when none is a reasonable fit (generic/admin/junk "
    "labels like 'Other', 'Remote', 'Full Time', a location, or 'Tenders & "
    "RFPs' must be null). Judge by the category's primary economic activity."
)


def _prompt(sectors: list[str], categories: list[str]) -> str:
    return (
        f"Allowed sectors (use these EXACT strings):\n{json.dumps(sectors)}\n\n"
        f"Categories to classify:\n{json.dumps(categories)}\n\n"
        'Return ONLY a JSON object mapping every input category string to one '
        'allowed sector string or null. No prose.'
    )


async def _distinct_leading_tokens(coll) -> collections.Counter:
    """Count jobs per ``category`` leading token."""
    counts: collections.Counter = collections.Counter()
    async for doc in coll.find({}, {"category": 1}):
        token = category_leading_token(doc.get("category"))
        if token:
            counts[token] += 1
    return counts


async def _classify(sectors: list[str], tokens: list[str], cfg: LLMConfig) -> dict:
    """One LLM call -> ``{token: sector|None}`` (values not in ``sectors`` -> None)."""
    llm = GeminiGenerativeLLM(system_instructions=_SYSTEM, config=cfg)
    raw = json.loads((await llm.generate_content(_prompt(sectors, tokens))).text)
    allowed = set(sectors)
    return {t: (raw.get(t) if raw.get(t) in allowed else None) for t in tokens}


def _build_artifact(sectors, token_counts, mapping, total_jobs, model) -> dict:
    mapped_jobs = sum(n for t, n in token_counts.items() if mapping.get(t))
    return {
        "_meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model": model,
            "source": "teveta-master.json institutions[].sectors + live job.category",
            "jobs_collection": os.environ["JOBS_COLLECTION_NAME"].strip(),
            "total_jobs": total_jobs,
            "mapped_jobs": mapped_jobs,
            "coverage_pct": round(mapped_jobs / total_jobs * 100, 1) if total_jobs else 0.0,
            "note": "Generated, not hand-maintained. Re-run the module to refresh.",
        },
        "sectors": sectors,
        "category_to_sector": dict(sorted(mapping.items())),
    }


async def main() -> None:
    """Generate and write ``sector_category_map.json``."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--min-count", type=int, default=1,
                        help="Only classify category tokens seen on >= this many jobs.")
    parser.add_argument("--min-coverage-pct", type=float, default=50.0,
                        help="Refuse to write if job coverage falls below this percent "
                             "(guards against a degraded LLM run silently shipping a "
                             "near-empty map). Lower it deliberately if a low result is "
                             "genuinely expected.")
    args = parser.parse_args()

    # Drop the "All Sectors" sentinel: a real sectors[] value but not a
    # filterable target — mapping a category to it would make it unreachable.
    sectors = [s for s in get_institution_sectors() if s.strip().lower() != "all sectors"]
    client = AsyncIOMotorClient(os.environ["JOBS_MONGODB_URI"].strip())
    coll = client[os.environ["JOBS_DATABASE_NAME"].strip()][
        os.environ["JOBS_COLLECTION_NAME"].strip()
    ]
    total_jobs = await coll.count_documents({})
    token_counts = await _distinct_leading_tokens(coll)
    tokens = sorted(t for t, n in token_counts.items() if n >= args.min_count)
    logger.info("Classifying %d category tokens into %d sectors (%d jobs)",
                len(tokens), len(sectors), total_jobs)

    cfg = LLMConfig(generation_config=JSON_GENERATION_CONFIG)
    mapping = await _classify(sectors, tokens, cfg)
    artifact = _build_artifact(sectors, token_counts, mapping, total_jobs,
                               cfg.language_model_name)
    client.close()

    coverage = artifact["_meta"]["coverage_pct"]
    if coverage < args.min_coverage_pct:
        raise SystemExit(
            f"Refusing to write {_OUT_PATH.name}: job coverage {coverage}% is below "
            f"--min-coverage-pct {args.min_coverage_pct}% — likely a degraded LLM run. "
            "Re-run, or lower --min-coverage-pct if this low result is expected."
        )
    _OUT_PATH.write_text(json.dumps(artifact, indent=2, ensure_ascii=False) + "\n")
    logger.info("Wrote %s — %.1f%% job coverage (%d/%d)", _OUT_PATH,
                artifact["_meta"]["coverage_pct"], artifact["_meta"]["mapped_jobs"],
                total_jobs)


if __name__ == "__main__":
    asyncio.run(main())
