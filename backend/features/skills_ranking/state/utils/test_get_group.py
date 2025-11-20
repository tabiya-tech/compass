from features.skills_ranking.state.services.type import SkillRankingExperimentGroup
from features.skills_ranking.state.utils.get_group import (
    _AVAILABLE_GROUPS,
    get_group,
    get_group_based_on_randomization,
)


class TestGetGroupBasedOnRandomization:
    def test_get_group_based_on_randomization(self, mocker):
        mock_generator = mocker.MagicMock()
        mock_generator.choice.return_value = SkillRankingExperimentGroup.GROUP_2
        mocker.patch('features.skills_ranking.state.utils.get_group._random_generator', mock_generator)

        actual_group = get_group_based_on_randomization()

        assert actual_group == SkillRankingExperimentGroup.GROUP_2
        mock_generator.choice.assert_called_once_with(_AVAILABLE_GROUPS)


class TestGetGroup:
    def test_get_group(self, mocker):
        mocker.patch(
            "features.skills_ranking.state.utils.get_group.get_group_based_on_randomization",
            return_value=SkillRankingExperimentGroup.GROUP_3
        )

        actual_group = get_group()

        assert actual_group == SkillRankingExperimentGroup.GROUP_3
