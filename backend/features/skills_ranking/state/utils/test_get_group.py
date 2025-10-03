import pytest
from pydantic import BaseModel

from features.skills_ranking.state.services.type import SkillRankingExperimentGroup
from features.skills_ranking.state.utils.get_group import TargetGroup, _get_group_based_on_ranks, get_group_based_on_randomization, get_group

TEST_THRESHOLD = 0.2


class TestCase(BaseModel):
    given_target_group: TargetGroup
    """
    The target group for the test case, either HIGH_DIFFERENCE or UNDERCONFIDENT.
    50-50 chance to be assigned to either group.
    """

    given_self_estimated_rank: float
    """
    The self-estimated rank of the participant.
    """

    given_actual_rank: float
    """
    The actual rank of the participant.
    """

    expected_group: SkillRankingExperimentGroup
    """
    The expected group that the participant should be assigned to.
    """

    doc: str


test_cases: list[TestCase] = [
    # HIGH DIFFERENCE group cases
    TestCase(
        given_target_group=TargetGroup.HIGH_DIFFERENCE,
        given_self_estimated_rank=0,
        given_actual_rank=1,
        expected_group=SkillRankingExperimentGroup.GROUP_1,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            
            has_high_difference = abs(100 - 0) > 20 == True
            if has_high_difference: we are in GROUP_1
            """
    ),
    TestCase(
        given_target_group=TargetGroup.HIGH_DIFFERENCE,
        given_self_estimated_rank=0.5,
        given_actual_rank=0.8,
        expected_group=SkillRankingExperimentGroup.GROUP_1,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            has_high_difference = abs(50 - 80) > 20 == True
            if has_high_difference: we are in GROUP_1
            """
    ),
    TestCase(
        given_target_group=TargetGroup.HIGH_DIFFERENCE,
        given_self_estimated_rank=0,
        given_actual_rank=1,
        expected_group=SkillRankingExperimentGroup.GROUP_1,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            
            has_high_difference = abs(0 - 100) > 20 == True
            if has_high_difference: we are in GROUP_1
            """
    ),
    TestCase(
        given_target_group=TargetGroup.HIGH_DIFFERENCE,
        given_self_estimated_rank=0.5,
        given_actual_rank=0.4,
        expected_group=SkillRankingExperimentGroup.GROUP_2,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            has_high_difference = abs(50 - 40) > 20 == False
            if not has_high_difference: we are in GROUP_2
            """
    ),
    TestCase(
        given_target_group=TargetGroup.HIGH_DIFFERENCE,
        given_self_estimated_rank=1,
        given_actual_rank=1,
        expected_group=SkillRankingExperimentGroup.GROUP_2,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            has_high_difference = abs(100 - 100) > 20 == False
            if not has_high_difference: we are in GROUP_2
            """
    ),

    TestCase(
        given_target_group=TargetGroup.HIGH_DIFFERENCE,
        given_self_estimated_rank=0,
        given_actual_rank=0,
        expected_group=SkillRankingExperimentGroup.GROUP_2,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            has_high_difference = abs(0 - 0) > 20 == False
            if not has_high_difference: we are in GROUP_2
            """
    ),

    TestCase(
        given_target_group=TargetGroup.HIGH_DIFFERENCE,
        given_self_estimated_rank=0.1,
        given_actual_rank=0.3,
        expected_group=SkillRankingExperimentGroup.GROUP_2,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            has_high_difference = abs(10 - 30) > 20 == False
            if not has_high_difference: we are in GROUP_2
            """
    ),

    # UNDERCONFIDENCE group cases
    TestCase(
        given_target_group=TargetGroup.UNDERCONFIDENT,
        given_self_estimated_rank=0.5,
        given_actual_rank=0.3,
        expected_group=SkillRankingExperimentGroup.GROUP_4,
        doc="""
            Since we are using UNDERCONFIDENT VALUE to generate the group,
            is_underconfident = (30 - 50) > 0 == False
            
            if is_underconfident: we are in GROUP_4
            """
    ),
    TestCase(
        given_target_group=TargetGroup.UNDERCONFIDENT,
        given_self_estimated_rank=1,
        given_actual_rank=1,
        expected_group=SkillRankingExperimentGroup.GROUP_4,
        doc="""
            Since we are using UNDERCONFIDENT VALUE to generate the group,
            is_underconfident = (100 - 100) > 0 == False
            
            if not is_underconfident: we are in GROUP_4
            """
    ),
    TestCase(
        given_target_group=TargetGroup.UNDERCONFIDENT,
        given_self_estimated_rank=0.5,
        given_actual_rank=0.8,
        expected_group=SkillRankingExperimentGroup.GROUP_3,
        doc="""
            Since we are using UNDERCONFIDENT VALUE to generate the group,
            is_underconfident = (50 - 30) > 0 == False
            
            if not is_underconfident: we are in GROUP_3
            """
    ),
]


class TestGetGroupBasedOnRanks:
    @pytest.mark.parametrize("case", [
        pytest.param(
            case,
            id=f"should return {case.expected_group.name}, given group:{case.expected_group},self rank:{case.given_self_estimated_rank} and actual rank:{case.given_actual_rank}"
        ) for case in test_cases])
    def test_compute_group(self, case: TestCase, mocker):
        # GIVEN the self_estimated_rank
        given_self_estimated_rank = case.given_self_estimated_rank

        # AND the actual value is 80,
        given_actual_rank = case.given_actual_rank

        # AND the threshold
        given_threshold = TEST_THRESHOLD

        # AND the random will return a specific target group
        mocker.patch("features.skills_ranking.state.utils.get_group._get_random_group", return_value=case.given_target_group)

        # WHEN we compute the group
        actual_group = _get_group_based_on_ranks(
            self_estimated_rank=given_self_estimated_rank,
            actual_rank=given_actual_rank,
            high_difference_threshold=given_threshold
        )

        # THEN the actual_group should be GROUP_1
        assert actual_group == case.expected_group, f"Expected {case.expected_group}, but got {actual_group} for case: {case}"


class TestGetGroupBasedOnRandomization:
    def test_get_group_based_on_randomization(self, mocker):
        # GIVEN random generate.choice is will should return GROUP_1
        mock_generator = mocker.MagicMock()
        mock_generator.choice.return_value = SkillRankingExperimentGroup.GROUP_1
        mocker.patch('features.skills_ranking.state.utils.get_group._random_generator', mock_generator)

        # WHEN we get the group based on randomization
        actual_group = get_group_based_on_randomization()

        # THEN the actual group should GROUP 1
        assert actual_group == SkillRankingExperimentGroup.GROUP_1, f"Expected one of the four groups, but got {actual_group}"

        # AND random.generate.choice should be called with all four groups
        mock_generator.choice.assert_called_once_with(
            [SkillRankingExperimentGroup.GROUP_2, SkillRankingExperimentGroup.GROUP_3])



class TestGetGroup:
    def test_get_group(self, mocker):
        # GIVEN the self_estimated_rank
        given_self_estimated_rank = 0.5

        # AND the actual value is 80,
        given_actual_rank = 0.8

        # AND the threshold
        given_threshold = TEST_THRESHOLD

        # AND the get_group_based_on_randomization will return GROUP_1
        mocker.patch("features.skills_ranking.state.utils.get_group.get_group_based_on_randomization",
                     return_value=SkillRankingExperimentGroup.GROUP_1)

        # WHEN we compute the group
        actual_group = get_group(
            self_estimated_rank=given_self_estimated_rank,
            actual_rank=given_actual_rank,
            high_difference_threshold=given_threshold
        )

        # THEN the actual_group should be GROUP_1
        assert actual_group == SkillRankingExperimentGroup.GROUP_1, f"Expected GROUP_1, but got {actual_group}"
