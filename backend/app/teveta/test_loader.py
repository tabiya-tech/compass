"""Tests for the TEVETA sector data loader."""
from unittest.mock import patch

import pytest

from app.teveta.loader import get_sector_data, SECTOR_KEY_MAP

_SAMPLE_DATA = {
    "critical_skills": [
        {"sector": "Energy", "occupation": "Solar PV Installer", "zqf": "4"},
        {"sector": "Mining", "occupation": "Geologist", "zqf": "6"},
    ],
    "programmes": [
        {"name": "Electrical Engineering", "zqf": "6", "priority_sectors": {"Energy": True}},
        {"name": "Heavy Equipment Repair", "zqf": "4", "priority_sectors": {"Mining": True}},
        {"name": "Welding", "zqf": "3", "priority_sectors": {"Energy": True, "Mining": True}},
    ],
    "priority_curriculum": [
        {"sector": "Energy", "occupation": "Solar PV Installer", "status": "Develop", "ranking": "1"},
        {"sector": "Energy", "occupation": "Cable Jointer", "status": "Develop", "ranking": "4"},
        {"sector": "Mining", "occupation": "Geologist", "status": "Review", "ranking": "2"},
    ],
    "institutions": [
        {"name": "College A", "sectors": ["Electricity & Gas", "Manufacturing"]},
        {"name": "College B", "sectors": ["Mining"]},
        {"name": "College C", "sectors": ["Electricity & Gas"]},
        {"name": "College D", "sectors": ["Water & Waste"]},
        {"name": "College E", "sectors": ["Agriculture"]},
    ],
}


@pytest.fixture(autouse=True)
def _mock_data():
    """Patch get_data so we never read the real JSON file."""
    with patch("app.teveta.loader.get_data", return_value=_SAMPLE_DATA):
        yield


class TestGetSectorData:
    """Tests for the get_sector_data function."""

    def test_returns_none_for_unknown_sector(self):
        # GIVEN an unknown sector name
        given_sector = "Telecom"

        # WHEN the sector data is requested
        actual_result = get_sector_data(given_sector)

        # THEN expect None
        assert actual_result is None

    def test_returns_correct_critical_skills_for_energy(self):
        # GIVEN the sample TEVETA data (via autouse fixture)

        # WHEN the Energy sector data is requested
        actual_result = get_sector_data("Energy")

        # THEN expect only Energy critical skills
        assert len(actual_result["critical_skills"]) == 1
        assert actual_result["critical_skills"][0]["occupation"] == "Solar PV Installer"

    def test_returns_correct_programmes_for_energy(self):
        # GIVEN the sample TEVETA data (via autouse fixture)

        # WHEN the Energy sector data is requested
        actual_result = get_sector_data("Energy")

        # THEN expect programmes tagged with Energy
        assert actual_result["programme_count"] == 2
        expected_programme_names = {"Electrical Engineering", "Welding"}
        actual_programme_names = {p["name"] for p in actual_result["programmes"]}
        assert actual_programme_names == expected_programme_names

    def test_returns_correct_priority_curriculum_for_energy(self):
        # GIVEN the sample TEVETA data (via autouse fixture)

        # WHEN the Energy sector data is requested
        actual_result = get_sector_data("Energy")

        # THEN expect only Energy priority curriculum entries
        assert len(actual_result["priority_curriculum"]) == 2
        expected_occupations = {"Solar PV Installer", "Cable Jointer"}
        actual_occupations = {p["occupation"] for p in actual_result["priority_curriculum"]}
        assert actual_occupations == expected_occupations

    def test_maps_energy_to_electricity_and_gas_for_institutions(self):
        # GIVEN the sample TEVETA data (via autouse fixture)

        # WHEN the Energy sector data is requested
        actual_result = get_sector_data("Energy")

        # THEN expect institutions tagged with "Electricity & Gas" to be counted
        assert actual_result["institution_count"] == 2

    def test_maps_water_to_water_and_waste_for_institutions(self):
        # GIVEN the sample TEVETA data (via autouse fixture)

        # WHEN the Water sector data is requested
        actual_result = get_sector_data("Water")

        # THEN expect institutions tagged with "Water & Waste" to be counted
        assert actual_result["institution_count"] == 1

    def test_mining_uses_same_key_for_institutions(self):
        # GIVEN the sample TEVETA data (via autouse fixture)

        # WHEN the Mining sector data is requested
        actual_result = get_sector_data("Mining")

        # THEN expect institutions tagged with "Mining" to be counted
        assert actual_result["institution_count"] == 1
        # AND expect the correct critical skill
        assert actual_result["critical_skills"][0]["occupation"] == "Geologist"

    def test_hospitality_maps_to_tourism(self):
        # GIVEN the sample TEVETA data (via autouse fixture)

        # WHEN the Hospitality sector data is requested
        actual_result = get_sector_data("Hospitality")

        # THEN expect the sector key to map to Tourism (no matching sample data)
        assert actual_result["sector"] == "Hospitality"
        assert actual_result["institution_count"] == 0
        assert actual_result["programme_count"] == 0

    @pytest.mark.parametrize("given_sector", list(SECTOR_KEY_MAP.keys()))
    def test_all_valid_sectors_return_data(self, given_sector):
        # GIVEN the sample TEVETA data (via autouse fixture)

        # WHEN the sector data is requested
        actual_result = get_sector_data(given_sector)

        # THEN expect a dict with the expected keys
        assert actual_result is not None
        assert "sector" in actual_result
        assert "institution_count" in actual_result
        assert "programme_count" in actual_result
        assert "critical_skills" in actual_result

    def test_ranking_values_are_strings(self):
        # GIVEN the sample TEVETA data (via autouse fixture)

        # WHEN the Energy sector data is requested
        actual_result = get_sector_data("Energy")

        # THEN expect all ranking values to be strings (not integers)
        for entry in actual_result["priority_curriculum"]:
            if entry.get("ranking") is not None:
                assert isinstance(entry["ranking"], str), (
                    f"ranking for {entry['occupation']} is {type(entry['ranking']).__name__}, expected str"
                )
