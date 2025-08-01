import pytest
from pydantic import BaseModel

from features.skills_ranking.state.services.type import SkillRankingExperimentGroup
from features.skills_ranking.state.utils.get_group import TargetGroup, get_group

TEST_THRESHOLD = 20


class TestCase(BaseModel):
    target_group: TargetGroup
    """
    The target group for the test case, either HIGH_DIFFERENCE or UNDERCONFIDENT.
    50-50 chance to be assigned to either group.
    """

    self_estimated_rank: float
    """
    The self-estimated rank of the participant.
    """

    actual_rank: float
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
        target_group=TargetGroup.HIGH_DIFFERENCE,
        self_estimated_rank=0,
        actual_rank=100,
        expected_group=SkillRankingExperimentGroup.GROUP_1,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            
            has_high_difference = abs(100 - 0) > 20 == True
            if has_high_difference: we are in GROUP_1
            """
    ),
    TestCase(
        target_group=TargetGroup.HIGH_DIFFERENCE,
        self_estimated_rank=50,
        actual_rank=80,
        expected_group=SkillRankingExperimentGroup.GROUP_1,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            has_high_difference = abs(50 - 80) > 20 == True
            if has_high_difference: we are in GROUP_1
            """
    ),
    TestCase(
        target_group=TargetGroup.HIGH_DIFFERENCE,
        self_estimated_rank=0,
        actual_rank=100,
        expected_group=SkillRankingExperimentGroup.GROUP_1,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            
            has_high_difference = abs(0 - 100) > 20 == True
            if has_high_difference: we are in GROUP_1
            """
    ),
    TestCase(
        target_group=TargetGroup.HIGH_DIFFERENCE,
        self_estimated_rank=50,
        actual_rank=40,
        expected_group=SkillRankingExperimentGroup.GROUP_2,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            has_high_difference = abs(50 - 40) > 20 == False
            if not has_high_difference: we are in GROUP_2
            """
    ),
    TestCase(
        target_group=TargetGroup.HIGH_DIFFERENCE,
        self_estimated_rank=100,
        actual_rank=100,
        expected_group=SkillRankingExperimentGroup.GROUP_2,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            has_high_difference = abs(100 - 100) > 20 == False
            if not has_high_difference: we are in GROUP_2
            """
    ),

    TestCase(
        target_group=TargetGroup.HIGH_DIFFERENCE,
        self_estimated_rank=0,
        actual_rank=0,
        expected_group=SkillRankingExperimentGroup.GROUP_2,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            has_high_difference = abs(0 - 0) > 20 == False
            if not has_high_difference: we are in GROUP_2
            """
    ),

    TestCase(
        target_group=TargetGroup.HIGH_DIFFERENCE,
        self_estimated_rank=10,
        actual_rank=30,
        expected_group=SkillRankingExperimentGroup.GROUP_2,
        doc="""
            Since we are using HIGH_DIFFERENCE VALUE to generate the group,
            has_high_difference = abs(10 - 30) > 20 == False
            if not has_high_difference: we are in GROUP_2
            """
    ),

    # UNDERCONFIDENCE group cases
    TestCase(
        target_group=TargetGroup.UNDERCONFIDENT,
        self_estimated_rank=50,
        actual_rank=30,
        expected_group=SkillRankingExperimentGroup.GROUP_3,
        doc="""
            Since we are using UNDERCONFIDENT VALUE to generate the group,
            is_underconfident = (50 - 30) > 0 == True
            
            if is_underconfident: we are in GROUP_3
            """
    ),
    TestCase(
        target_group=TargetGroup.UNDERCONFIDENT,
        self_estimated_rank=100,
        actual_rank=100,
        expected_group=SkillRankingExperimentGroup.GROUP_4,
        doc="""
            Since we are using UNDERCONFIDENT VALUE to generate the group,
            is_underconfident = (100 - 100) > 0 == False
            
            if not is_underconfident: we are in GROUP_4
            """
    ),
    TestCase(
        target_group=TargetGroup.UNDERCONFIDENT,
        self_estimated_rank=50,
        actual_rank=80,
        expected_group=SkillRankingExperimentGroup.GROUP_4,
        doc="""
            Since we are using UNDERCONFIDENT VALUE to generate the group,
            is_underconfident = (50 - 30) > 0 == True
            
            if not is_underconfident: we are in GROUP_4
            """
    ),
]


@pytest.mark.parametrize("case", [
    pytest.param(
        case,
        id=f"should return {case.expected_group.name}, given group:{case.expected_group},self rank:{case.self_estimated_rank} and actual rank:{case.actual_rank}"
    ) for case in test_cases])
def test_compute_group(case: TestCase, mocker):
    # GIVEN the self_estimated_rank
    given_self_estimated_rank = case.self_estimated_rank

    # AND the actual value is 80,
    given_actual_rank = case.actual_rank

    # AND the threshold
    given_threshold = TEST_THRESHOLD

    # AND the random will return a specific target group
    mocker.patch("features.skills_ranking.state.utils.get_group._get_random_group", return_value=case.target_group)

    # WHEN we compute the group
    result = get_group(
        self_estimated_rank=given_self_estimated_rank,
        actual_rank=given_actual_rank,
        high_difference_threshold=given_threshold
    )

    # THEN the result should be GROUP_1
    assert result == case.expected_group, f"Expected {case.expected_group}, but got {result} for case: {case}"
