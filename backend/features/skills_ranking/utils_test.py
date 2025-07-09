from features.skills_ranking.service.types import SkillsRankingPhase
from features.skills_ranking.utils import get_possible_next_states


def test_get_possible_next_states():
    # GIVEN initial state
    # WHEN getting possible next states
    next_states = get_possible_next_states("INITIAL")
    # THEN the next state should be BRIEFING
    assert next_states == ["BRIEFING"]
    # GIVEN briefing state
    next_states = get_possible_next_states("BRIEFING")
    # WHEN getting possible next states
    # THEN the next state should be EFFORT
    assert next_states == ["EFFORT"]
    # GIVEN effort state
    next_states = get_possible_next_states("EFFORT")
    # WHEN getting possible next states
    # THEN the next states should be DISCLOSURE or CANCELLED
    assert next_states == ["DISCLOSURE", "CANCELLED"]
    # GIVEN disclosure state
    next_states = get_possible_next_states("DISCLOSURE")
    # WHEN getting possible next states
    # THEN the next state should be PERCEIVED_RANK
    assert next_states == ["PERCEIVED_RANK"]
    # GIVEN perceived rank state
    next_states = get_possible_next_states("PERCEIVED_RANK")
    # WHEN getting possible next states
    # THEN the next state should be RETYPED_RANK
    assert next_states == ["RETYPED_RANK"]
    # GIVEN retyped rank state
    next_states = get_possible_next_states("RETYPED_RANK")
    # WHEN getting possible next states
    # THEN the next state should be COMPLETED
    assert next_states == ["COMPLETED"]
    # GIVEN cancelled state
    next_states = get_possible_next_states("CANCELLED")
    # WHEN getting possible next states
    # THEN there should be no next states
    assert next_states == []
    # GIVEN completed state
    next_states = get_possible_next_states("COMPLETED")
    # WHEN getting possible next states
    # THEN there should be no next states
    assert next_states == []
