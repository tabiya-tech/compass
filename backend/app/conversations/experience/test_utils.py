import pytest
from types import SimpleNamespace

from ._types import SkillUpdate
from .utils import _get_skills_update_value, compute_top_skill_changes
from ._types import convert_skill_entities_to_skills_response
from ...vector_search.esco_entities import SkillEntity
from features.skills_granularity.skill_parent_mapping_store import (
    get_parent_label,
    set_cache_for_tests,
    clear_cache_for_tests,
)


def _get_test_skill_entity(_id: str, preferred_label: str = "Test Skill") -> SkillEntity:
    return SkillEntity(
        id=_id,
        UUID=_id,
        preferredLabel=preferred_label,
        altLabels=["Updated Skill", "Updated Skill 2", "Updated Skill 1", "Test Skill Alt"],
        description="A test skill entity.",
        score=1.0,
        skillType="skill/competence"
    )


class TestGetSkillsUpdateValue:
    @pytest.mark.parametrize(
        "update_value, skills_map, expected_new_skills", [
            pytest.param(
                [],
                {},
                [],
                id="empty_update_with_empty_skills_map"
            ),
            pytest.param(
                [],
                {
                    "skill_uuid_1": _get_test_skill_entity("skill_uuid_1"),
                },
                [],
                id="empty_update_with_non_empty_skills_map"
            ),
            pytest.param(
                [
                    SkillUpdate(
                        UUID="skill_uuid_1",
                        preferredLabel="Updated Skill"
                    ).model_dump()
                ],
                {
                    "skill_uuid_1": (0, _get_test_skill_entity("skill_uuid_1")),
                },
                [
                    (0, _get_test_skill_entity("skill_uuid_1", preferred_label="Updated Skill"))
                ],
                id="all_skills_with_one_item"
            ),
            pytest.param(
                [
                    SkillUpdate(
                        UUID="skill_uuid_2",
                        preferredLabel="Updated Skill 2"
                    ).model_dump(),
                    SkillUpdate(
                        UUID="skill_uuid_1",
                        preferredLabel="Updated Skill 1"
                    ).model_dump(),
                ],
                {
                    "skill_uuid_1": (0, _get_test_skill_entity("skill_uuid_1")),
                    "skill_uuid_2": (1, _get_test_skill_entity("skill_uuid_2")),
                },
                [
                    (1, _get_test_skill_entity("skill_uuid_2", preferred_label="Updated Skill 2")),
                    (0, _get_test_skill_entity("skill_uuid_1", preferred_label="Updated Skill 1")),
                ],
                id="all_skills_with_more_than_1_item"
            ),
        ])
    def test_get_skills_update_value_success(self, update_value, skills_map, expected_new_skills):
        # GIVEN an update value.
        given_update_value = update_value

        # AND the `skills_map`
        given_skills_map = skills_map

        # WHEN the function is called.
        result = _get_skills_update_value(given_update_value, given_skills_map)

        # THEN the result should be an empty list.
        assert result == expected_new_skills


class TestComputeTopSkillChanges:
    @pytest.mark.parametrize("prev_skills, payload, expected", [
        (
                [(0, _get_test_skill_entity("s1", "label1"))],
                None,
                {"ADDED": set(), "DELETED": set(), "EDITED": set()},
        ),
        (
                [(0, _get_test_skill_entity("s1", "label1"))],
                [{"UUID": "s1", "preferredLabel": "label1"}],
                {"ADDED": set(), "DELETED": set(), "EDITED": set()},
        ),
        (
                [(0, _get_test_skill_entity("s1", "label1"))],
                [
                    {"UUID": "s1", "preferredLabel": "label1"},
                    {"UUID": "s2", "preferredLabel": "label2"},
                ],
                {"ADDED": {"s2"}, "DELETED": set(), "EDITED": set()},
        ),
        (
                [(0, _get_test_skill_entity("s1", "label1"))],
                [],
                {"ADDED": set(), "DELETED": {"s1"}, "EDITED": set()},
        ),
        (
                [(0, _get_test_skill_entity("s1", "old"))],
                [{"UUID": "s1", "preferredLabel": "new"}],
                {"ADDED": set(), "DELETED": set(), "EDITED": {"s1"}},
        ),
    ])
    def test_compute_top_skill_changes(self, prev_skills, payload, expected):
        # GIVEN an experience entity with previous top skills
        exp = SimpleNamespace(top_skills=prev_skills)

        # WHEN compute_top_skill_changes is called with a new payload
        result = compute_top_skill_changes(exp, payload)

        # THEN the result should match the expected sets for ADDED, DELETED, and EDITED skills
        assert result == expected


class TestConvertSkillEntitiesToSkillsResponse:
    def test_deduplicates_after_parent_mapping(self):
        # GIVEN two child skills mapping to the same parent
        set_cache_for_tests({"child-1": "Parent Skill", "child-2": "Parent Skill"})

        skills = [
            SkillEntity(
                id="child-1",
                UUID="child-1",
                preferredLabel="Child One",
                altLabels=[],
                description="",
                score=1.0,
                skillType="skill/competence",
            ),
            SkillEntity(
                id="child-2",
                UUID="child-2",
                preferredLabel="Child Two",
                altLabels=[],
                description="",
                score=0.9,
                skillType="skill/competence",
            ),
        ]

        # WHEN converting to responses
        responses = convert_skill_entities_to_skills_response(skills)

        # THEN only the mapped parent label appears once
        assert len(responses) == 1
        assert responses[0].preferredLabel == "Parent Skill"
        assert responses[0].orderIndex == 0

        clear_cache_for_tests()


class TestSkillParentMappingStore:
    def test_lookup_and_fallback(self):
        # GIVEN a mapping cache with one entry
        set_cache_for_tests({"child-1": "Parent Label"})

        # WHEN looking up an existing child skill id
        assert get_parent_label("child-1") == "Parent Label"

        # THEN a missing child skill id returns None
        assert get_parent_label("missing") is None

        clear_cache_for_tests()
