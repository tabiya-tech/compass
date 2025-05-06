from modules.skills_ranking.service.types import SkillsRankingCurrentState
from modules.skills_ranking.utils import get_possible_next_states


def test_get_possible_next_states():
    # GIVEN initial state
    # WHEN getting possible next states
    next_states = get_possible_next_states(SkillsRankingCurrentState.INITIAL)
    # THEN should return self evaluating and skipped
    assert next_states == [
        SkillsRankingCurrentState.SELF_EVALUATING,
        SkillsRankingCurrentState.SKIPPED,
    ]

    # GIVEN self evaluating state
    # WHEN getting possible next states
    next_states = get_possible_next_states(SkillsRankingCurrentState.SELF_EVALUATING)
    # THEN should return evaluated
    assert next_states == [SkillsRankingCurrentState.EVALUATED]

    # GIVEN skipped state
    # WHEN getting possible next states
    next_states = get_possible_next_states(SkillsRankingCurrentState.SKIPPED)
    # THEN should return empty list
    assert next_states == []

    # GIVEN evaluated state
    # WHEN getting possible next states
    next_states = get_possible_next_states(SkillsRankingCurrentState.EVALUATED)
    # THEN should return empty list
    assert next_states == []
