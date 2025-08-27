from enum import IntEnum
import numpy as np

from features.skills_ranking.state.services.type import SkillRankingExperimentGroup


class TargetGroup(IntEnum):
    """
    50-50 chance to be assigned to either group.
    """
    HIGH_DIFFERENCE = 0
    UNDERCONFIDENT = 1


# Randomly choose what value to use when computing the group. (High difference value or underconfident value)
_random_generator = np.random.default_rng(seed=[])


def _get_random_group() -> TargetGroup:
    return _random_generator.choice([TargetGroup.HIGH_DIFFERENCE, TargetGroup.UNDERCONFIDENT])


def _get_group_based_on_ranks(*,
                              self_estimated_rank: float,
                              actual_rank: float,
                              high_difference_threshold: float) -> SkillRankingExperimentGroup:
    """
    Assigns participants to one of four experimental groups based on the difference between their self-assessed ranking (`prior_belief`),
    And the actual ranking (`actual_value`), and a `high_difference_threshold` value (`high_difference_threshold`).

    The groups are determined by randomly selecting between two target groups:
    — `TargetGroup.HIGH_DIFFERENCE`: Assigns based on whether the difference is high.
        If a high difference between the self-estimated rank and the actual rank, the user is assigned to `GROUP_1`.
        If the difference is not high, the user is assigned to `GROUP_2`.

    — `TargetGroup.UNDERCONFIDENT`: Assigns based on whether the user is underconfident.
        If the user is underconfident (self-estimated rank is higher than actual rank), they are assigned to `GROUP_3`.
        If the user is not underconfident, they are assigned to `GROUP_4`.

    :param self_estimated_rank: The belief the user has about their skills ranks before the compass experiment.
    :param actual_rank: The actual ranking of the user as determined by the compass experiment.
    :param high_difference_threshold: The threshold value to determine the group assignment, especially when computing the high difference.
    """

    # Randomly choose the next group to use for the computation.
    target_group = _get_random_group()

    # Difference between self-estimated and actual rank
    belief_rank_gap = actual_rank - self_estimated_rank

    if target_group == TargetGroup.HIGH_DIFFERENCE:
        # -- Group 1: Will be assigned based on the high difference. --
        # Group 1a: if high_difference = True (GROUP_1)
        # Group 1b: if high_difference = False (GROUP_2)

        # Boolean: Was the belief-performance gap large (regardless of direction)?
        has_high_difference = abs(belief_rank_gap) > high_difference_threshold

        if has_high_difference:
            return SkillRankingExperimentGroup.GROUP_1
        else:
            return SkillRankingExperimentGroup.GROUP_2
    else:
        # -- Group 2: Will be assigned based on the underconfidence. --
        # Group 2a: if underconfident = True (GROUP_3)
        # Group 2b: if underconfident = False (GROUP_4)

        # Boolean: Did the participant underestimate their actual rank?
        is_underconfident = belief_rank_gap > 0

        if is_underconfident:
            return SkillRankingExperimentGroup.GROUP_3
        else:
            return SkillRankingExperimentGroup.GROUP_4


def get_group_based_on_randomization() -> SkillRankingExperimentGroup:
    """
    Assigns participants to one of four experimental groups based on randomization.
    :return: A randomly assigned SkillRankingExperimentGroup.
    """
    return _random_generator.choice(
        [SkillRankingExperimentGroup.GROUP_1, SkillRankingExperimentGroup.GROUP_2, SkillRankingExperimentGroup.GROUP_3,
         SkillRankingExperimentGroup.GROUP_4])


def get_group(*,
              self_estimated_rank: float,
              actual_rank: float,
              high_difference_threshold: float):
    # now we are using randomization to assign the group but we can use another strategy to assign the group based on ranks
    return get_group_based_on_randomization()
