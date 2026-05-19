"""Loads and caches teveta-master.json in memory at startup."""
import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_data: Optional[dict] = None

_DATA_PATH = Path(__file__).parent / "teveta-master.json"

# Maps the 5 knowledge hub sector names to the keys used in teveta-master.json
SECTOR_KEY_MAP = {
    "Agriculture": "Agriculture",
    "Energy": "Energy",
    "Hospitality": "Tourism",
    "Mining": "Mining",
    "Water": "Water",
}

# Institution records use different sector names than critical_skills/programmes.
# Keys must match the teveta_key values from SECTOR_KEY_MAP (not the hub sector names).
# TODO: consider normalizing sector names in teveta-master.json to eliminate this mapping
INSTITUTION_SECTOR_MAP = {
    "Energy": "Electricity & Gas",
    "Water": "Water & Waste",
    "Tourism": "Accommodation & Food",
}


def get_data() -> dict:
    global _data
    if _data is not None:
        return _data
    logger.info("Loading teveta-master.json from %s", _DATA_PATH)
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        loaded: dict = json.load(f)
    # Some priority_curriculum rows ship `ranking` as an int; downstream model is Optional[str].
    for entry in loaded.get("priority_curriculum", []):
        if isinstance(entry.get("ranking"), int):
            entry["ranking"] = str(entry["ranking"])
    logger.info(
        "Loaded teveta data: %d institutions, %d programmes, %d critical_skills",
        len(loaded.get("institutions", [])),
        len(loaded.get("programmes", [])),
        len(loaded.get("critical_skills", [])),
    )
    _data = loaded
    return loaded


def get_institution_sectors() -> list[str]:
    """Authoritative sector vocabulary: distinct, sorted ``institutions[].sectors``
    from teveta-master.json — the single source of truth for the sector names
    used across the app (matches the Sector dropdown's ``sectors_covered``)."""
    data = get_data()
    sectors: set[str] = set()
    for inst in data.get("institutions", []):
        for s in inst.get("sectors", []) or []:
            if isinstance(s, str) and s.strip():
                sectors.add(s.strip())
    return sorted(sectors)


def get_sector_data(sector: str) -> Optional[dict]:
    """
    Return filtered teveta data for a given sector name (as used in the knowledge hub).
    sector must be one of: Agriculture, Energy, Hospitality, Mining, Water
    """
    data = get_data()
    teveta_key = SECTOR_KEY_MAP.get(sector)
    if teveta_key is None:
        return None

    critical_skills = [s for s in data["critical_skills"] if s.get("sector") == teveta_key]
    programmes = [
        p for p in data["programmes"]
        if p.get("priority_sectors", {}).get(teveta_key)
    ]
    priority_curriculum = [
        p for p in data["priority_curriculum"]
        if p.get("sector") == teveta_key
    ]
    institution_key = INSTITUTION_SECTOR_MAP.get(teveta_key, teveta_key)
    institutions = [
        i for i in data["institutions"]
        if institution_key in i.get("sectors", [])
    ]

    return {
        "sector": sector,
        "institution_count": len(institutions),
        "programme_count": len(programmes),
        "critical_skills": critical_skills,
        "programmes": programmes,
        "priority_curriculum": priority_curriculum,
    }
