import hashlib
import pytest

from features.skills_ranking.ranking_service.utils.hash_opportunities_skills import hash_opportunities_skills


class TestComputingVersion:
    @pytest.mark.parametrize(
        "test_case",
        [
            dict(
                id="empty_list",
                given_skills=[],
                expected_string="[]" # the one to be md 5 hashed
            ),
            dict(
                id="single_empty_set",
                given_skills=[set()],
                expected_string='[[]]'  # the one to be md 5 hashed
            ),
            dict(
                id="multiple_empty_sets",
                given_skills=[set("1"), set()],
                expected_string='[["1"], []]'  # the one to be md 5 hashed
            ),
            dict(
                id="multiple_empty_sets with reversed order",
                given_skills=[set(), set("1")],
                expected_string='[["1"], []]'
            ),
            dict(
                id="single_set with multiple items ordered",
                given_skills=[{"1", "2"}],
                expected_string='[["1", "2"]]'
            ),
            dict(
                id="single set with multiple items unordered",
                given_skills=[{"2", "1"}],
                expected_string='[["1", "2"]]'
            )
        ],
        ids=lambda case: case["id"]
    )
    def test_compute_version_from_skills(self, test_case):
        # GIVEN a list of sets of skills
        given_skills = test_case["given_skills"]

        # WHEN _compute_version_from_skills is called
        actual_version = hash_opportunities_skills(given_skills)

        # THEN the version should be the MD5 hash of the expected string
        assert  actual_version == hashlib.md5(test_case["expected_string"].encode("utf-8")).hexdigest()  # nosec B324 - test reasons
