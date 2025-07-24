import pytest

from ._types import SkillUpdate
from .utils import _get_skills_update_value
from ...vector_search.esco_entities import SkillEntity


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
