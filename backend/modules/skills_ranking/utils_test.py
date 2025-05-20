from modules.skills_ranking.service.types import SkillsRankingPhase
from modules.skills_ranking.utils import get_possible_next_states


def test_get_possible_next_states():
    # GIVEN initial state
    # WHEN getting possible next states
    next_states = get_possible_next_states(SkillsRankingPhase.INITIAL)
    # THEN should return self evaluating and skipped
    assert next_states == [
        SkillsRankingPhase.SELF_EVALUATING,
        SkillsRankingPhase.SKIPPED,
    ]

    # GIVEN self evaluating state
    # WHEN getting possible next states
    next_states = get_possible_next_states(SkillsRankingPhase.SELF_EVALUATING)
    # THEN should return evaluated
    assert next_states == [SkillsRankingPhase.EVALUATED, SkillsRankingPhase.CANCELLED]

    # GIVEN skipped state
    # WHEN getting possible next states
    next_states = get_possible_next_states(SkillsRankingPhase.SKIPPED)
    # THEN should return empty list
    assert next_states == []

    # GIVEN evaluated state
    # WHEN getting possible next states
    next_states = get_possible_next_states(SkillsRankingPhase.EVALUATED)
    # THEN should return empty list
    assert next_states == []

    # GIVEN cancelled state
    # WHEN getting possible next states
    next_states = get_possible_next_states(SkillsRankingPhase.CANCELLED)
    # THEN should return empty list
    assert next_states == []
