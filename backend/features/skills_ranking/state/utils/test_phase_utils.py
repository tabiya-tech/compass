from features.skills_ranking.state.utils.phase_utils import get_possible_next_phase


def test_get_possible_next_states():
    # GIVEN initial state
    # WHEN getting possible next states
    next_states = get_possible_next_phase("INITIAL")
    # THEN the next state should include INITIAL and BRIEFING (for metrics-only updates)
    assert next_states == ["INITIAL", "BRIEFING"]

    # GIVEN briefing state
    next_states = get_possible_next_phase("BRIEFING")
    # WHEN getting possible next states
    # THEN the next state should include BRIEFING and PROOF_OF_VALUE
    assert next_states == ["BRIEFING", "PROOF_OF_VALUE"]

    # GIVEN proof_of_value state
    next_states = get_possible_next_phase("PROOF_OF_VALUE")
    # WHEN getting possible next states
    # THEN the next state should include PROOF_OF_VALUE and MARKET_DISCLOSURE
    assert next_states == ["PROOF_OF_VALUE", "MARKET_DISCLOSURE", "JOB_SEEKER_DISCLOSURE"]

    # GIVEN disclosure state
    next_states = get_possible_next_phase("MARKET_DISCLOSURE")
    # WHEN getting possible next states
    # THEN the next state should include MARKET_DISCLOSURE and JOB_SEEKER_DISCLOSURE
    assert next_states == ["MARKET_DISCLOSURE", "JOB_SEEKER_DISCLOSURE"]

    # GIVEN job seeker disclosure state
    next_states = get_possible_next_phase("JOB_SEEKER_DISCLOSURE")
    # WHEN getting possible next states
    # THEN the next state should include JOB_SEEKER_DISCLOSURE and PERCEIVED_RANK
    assert next_states == ["JOB_SEEKER_DISCLOSURE", "PERCEIVED_RANK"]

    # GIVEN perceived rank state
    next_states = get_possible_next_phase("PERCEIVED_RANK")
    # WHEN getting possible next states
    # THEN the next state should include PERCEIVED_RANK and RETYPED_RANK
    assert next_states == ["PERCEIVED_RANK", "RETYPED_RANK", "COMPLETED"]

    # GIVEN retyped rank state
    next_states = get_possible_next_phase("RETYPED_RANK")
    # WHEN getting possible next states
    # THEN the next state should include RETYPED_RANK and COMPLETED
    assert next_states == ["RETYPED_RANK", "COMPLETED"]

    # GIVEN completed state
    next_states = get_possible_next_phase("COMPLETED")
    # WHEN getting possible next states
    # THEN there should only be COMPLETED (terminal state but allows metrics updates)
    assert next_states == ["COMPLETED"]