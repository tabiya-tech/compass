"""
Sector filter for the job-demand chart (consumer side).

No authoritative ``job.category -> sector`` crosswalk exists, so it is generated
(not hand-maintained) into ``sector_category_map.json``; this module only reads
it. Regenerate via ``generate_sector_category_map.py``. See SECTOR_MAPPING.md.
"""
import json
import re
from pathlib import Path
from typing import Optional

_MAP_PATH = Path(__file__).parent / "sector_category_map.json"

# Treated as "no sector constraint" (the filter-options route already strips
# "all sectors", but be defensive).
_NO_FILTER_SENTINELS = {"", "all sectors", "all"}

_cache: Optional[dict] = None


def category_leading_token(category: Optional[str]) -> Optional[str]:
    """The category's leading token: ``"<token>"`` or ``"<token>, <rest>"`` ->
    ``token``. Shared by the runtime filter and the generator so both bucket
    categories identically."""
    if not isinstance(category, str) or not category.strip():
        return None
    return category.split(",")[0].strip() or None


def _category_to_sector() -> dict:
    """Cached ``{category_leading_token: sector|None}`` from the generated map."""
    global _cache
    cached = _cache
    if cached is None:
        if not _MAP_PATH.exists():
            raise RuntimeError(
                f"{_MAP_PATH.name} missing — run "
                "`python -m app.analytics.job_demand.generate_sector_category_map`"
            )
        try:
            cached = json.loads(_MAP_PATH.read_text()).get("category_to_sector", {})
        except json.JSONDecodeError as e:
            raise RuntimeError(
                f"{_MAP_PATH.name} is malformed — re-run the generator ({e})"
            ) from e
        _cache = cached
    return cached


def job_category_match(sector: Optional[str]) -> Optional[dict]:
    """Return a ``$match`` value for ``job.category`` for the given institution
    sector, or ``None`` for no sector constraint.

    Unknown or no-supply sectors return an impossible match (empty result)
    rather than silently falling back to market-wide data under a sector label.

    :param sector: institution sector label (Sector dropdown value).
    """
    if sector is None:
        return None
    key = sector.strip().lower()
    if key in _NO_FILTER_SENTINELS:
        return None
    prefixes = [
        cat for cat, sec in _category_to_sector().items()
        if isinstance(sec, str) and sec.strip().lower() == key
    ]
    if not prefixes:
        return {"$in": []}
    alternation = "|".join(re.escape(p) for p in sorted(prefixes))
    # Leading category token only: "<prefix>" exactly or "<prefix>,<rest>".
    return {"$regex": rf"^\s*(?:{alternation})\s*(?:$|,)", "$options": "i"}
