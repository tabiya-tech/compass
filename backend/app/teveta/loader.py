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


def get_data() -> dict:
    global _data
    if _data is None:
        logger.info("Loading teveta-master.json from %s", _DATA_PATH)
        with open(_DATA_PATH, "r", encoding="utf-8") as f:
            _data = json.load(f)
        logger.info(
            "Loaded teveta data: %d institutions, %d programmes, %d critical_skills",
            len(_data.get("institutions", [])),
            len(_data.get("programmes", [])),
            len(_data.get("critical_skills", [])),
        )
    return _data


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
    institutions = [
        i for i in data["institutions"]
        if teveta_key in i.get("sectors", [])
    ]

    return {
        "sector": sector,
        "institution_count": len(institutions),
        "programme_count": len(programmes),
        "critical_skills": critical_skills,
        "programmes": programmes,
        "priority_curriculum": priority_curriculum,
    }
