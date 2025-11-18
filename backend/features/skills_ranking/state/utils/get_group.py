from enum import IntEnum

import numpy as np

from features.skills_ranking.state.services.type import SkillRankingExperimentGroup

_random_generator = np.random.default_rng(seed=[])
_AVAILABLE_GROUPS = [
    SkillRankingExperimentGroup.GROUP_1,
    SkillRankingExperimentGroup.GROUP_2,
    SkillRankingExperimentGroup.GROUP_3,
]

def get_group_based_on_randomization() -> SkillRankingExperimentGroup:
    """
    Assigns participants to one of the three experiment groups with equal probability.
    """
    return _random_generator.choice(_AVAILABLE_GROUPS)


def get_group() -> SkillRankingExperimentGroup:
    """
    Primary helper used by the state service to assign experiment groups.
    """
    return get_group_based_on_randomization()
