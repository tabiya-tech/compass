"""
Tests for the generated sector -> job-category mapping consumer.

The actual mapping is generated (sector_category_map.json) and may be
regenerated, so behaviour tests inject a small fake map; one separate sanity
test validates the shipped artifact against the authoritative TEVETA sectors.
"""
import json
import re

import pytest

from app.analytics.job_demand import sector_mapping
from app.analytics.job_demand.sector_mapping import (
    category_leading_token,
    job_category_match,
)
from app.teveta.loader import get_institution_sectors

# Fake generated map injected for the behaviour tests (decouples them from the
# regenerable artifact).
_FAKE_MAP = {
    "IT & Telecoms": "ICT",
    "Software developer": "ICT",
    "Banking & Financial Services": "Finance & Insurance",
    "Other": None,
    "Tenders & RFPs": None,
}


@pytest.fixture()
def _injected_map(monkeypatch):
    # GIVEN a known generated map (independent of the shipped artifact)
    monkeypatch.setattr(sector_mapping, "_cache", _FAKE_MAP)


def _matches(constraint: dict, category: str) -> bool:
    """Apply a returned ``$regex`` constraint the way Mongo would."""
    return re.search(constraint["$regex"], category, re.IGNORECASE) is not None


class TestCategoryLeadingToken:
    @pytest.mark.parametrize("given, expected", [
        (None, None),
        ("", None),
        ("   ", None),
        (", trailing", None),
        ("IT & Telecoms", "IT & Telecoms"),
        ("IT & Telecoms, Software", "IT & Telecoms"),
        ("  Banking & Financial Services ,  x ", "Banking & Financial Services"),
        (123, None),
    ])
    def test_leading_token(self, given, expected):
        # WHEN the leading token is extracted
        actual = category_leading_token(given)
        # THEN it is the first comma-delimited token, trimmed (or None)
        assert actual == expected


class TestJobCategoryMatch:
    @pytest.mark.parametrize("given_sector", [None, "", "  ", "All Sectors", "all", "ALL SECTORS"])
    def test_no_constraint_for_none_or_all_sectors(self, given_sector, _injected_map):
        # WHEN there is no sector / the "all sectors" sentinel
        # THEN there is no sector constraint
        assert job_category_match(given_sector) is None

    def test_unmapped_sector_yields_impossible_match(self, _injected_map):
        # GIVEN a sector no category maps to (only null mappings / absent)
        # WHEN the match is built
        # THEN nothing can match it (empty chart, not market-wide data)
        assert job_category_match("Households") == {"$in": []}
        assert job_category_match("Public Administration") == {"$in": []}

    @pytest.mark.parametrize("given_sector, given_category, expected_match", [
        ("ICT", "IT & Telecoms", True),
        ("ICT", "IT & Telecoms, Information and Technology", True),
        ("ICT", "Software developer", True),                 # multi-prefix alternation
        ("ICT", "Banking & Financial Services", False),
        ("Finance & Insurance", "Banking & Financial Services, Broker", True),
        ("Finance & Insurance", "IT & Telecoms", False),
        # Leading-token semantics: a non-leading token must not count
        ("ICT", "Tenders & RFPs, IT & Telecoms", False),
        # Sector key is case-/whitespace-insensitive
        ("  ict  ", "IT & Telecoms", True),
    ])
    def test_leading_token_matching(self, given_sector, given_category, expected_match, _injected_map):
        # WHEN the category match for the sector is built
        actual = job_category_match(given_sector)
        # THEN it is a regex that matches per the leading-token contract
        assert "$regex" in actual
        assert _matches(actual, given_category) is expected_match


class TestShippedArtifact:
    """Validates the regenerable artifact itself (no monkeypatch)."""

    def test_artifact_is_well_formed_and_teveta_aligned(self):
        # GIVEN the shipped generated map
        data = json.loads(sector_mapping._MAP_PATH.read_text())
        # THEN it has the expected schema
        assert set(data) >= {"_meta", "sectors", "category_to_sector"}
        meta = data["_meta"]
        assert 0 <= meta["coverage_pct"] <= 100
        assert meta["total_jobs"] >= meta["mapped_jobs"] >= 0
        # AND every non-null mapped sector is an authoritative TEVETA sector
        authoritative = set(get_institution_sectors())
        mapped = {v for v in data["category_to_sector"].values() if v is not None}
        assert mapped, "expected at least one mapped category"
        assert mapped <= authoritative
        # "All Sectors" is a no-filter sentinel, never a valid mapped target.
        assert "All Sectors" not in mapped
