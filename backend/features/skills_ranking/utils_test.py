from features.skills_ranking.utils import get_possible_next_phase, get_valid_fields_for_phase


def test_get_possible_next_states():
    # GIVEN initial state
    # WHEN getting possible next states
    next_states = get_possible_next_phase("INITIAL")
    # THEN the next state should be BRIEFING
    assert next_states == ["BRIEFING"]

    # GIVEN briefing state
    next_states = get_possible_next_phase("BRIEFING")
    # WHEN getting possible next states
    # THEN the next state should be PROOF_OF_VALUE
    assert next_states == ["PROOF_OF_VALUE"]

    # GIVEN proof_of_value state
    next_states = get_possible_next_phase("PROOF_OF_VALUE")
    # WHEN getting possible next states
    # THEN the next states should be DISCLOSURE or CANCELLED
    assert next_states == ["MARKET_DISCLOSURE", "CANCELLED"]

    # GIVEN disclosure state
    next_states = get_possible_next_phase("MARKET_DISCLOSURE")
    # WHEN getting possible next states
    # THEN the next state should be PERCEIVED_RANK
    assert next_states == ["JOB_SEEKER_DISCLOSURE"]

    # GIVEN job seeker disclosure state
    next_states = get_possible_next_phase("JOB_SEEKER_DISCLOSURE")
    # WHEN getting possible next states
    # THEN the next state should be PERCEIVED_RANK
    assert next_states == ["PERCEIVED_RANK"]

    # GIVEN perceived rank state
    next_states = get_possible_next_phase("PERCEIVED_RANK")
    # WHEN getting possible next states
    # THEN the next state should be RETYPED_RANK
    assert next_states == ["RETYPED_RANK"]

    # GIVEN retyped rank state
    next_states = get_possible_next_phase("RETYPED_RANK")
    # WHEN getting possible next states
    # THEN the next state should be COMPLETED
    assert next_states == ["COMPLETED"]

    # GIVEN cancelled state
    next_states = get_possible_next_phase("CANCELLED")
    # WHEN getting possible next states
    # THEN there should be no next states
    assert next_states == []

    # GIVEN completed state
    next_states = get_possible_next_phase("COMPLETED")
    # WHEN getting possible next states
    # THEN there should be no next states
    assert next_states == []


def test_get_valid_fields_for_phase():
    # GIVEN initial phase
    # WHEN getting valid fields for initial phase
    valid_fields = get_valid_fields_for_phase("INITIAL")
    # THEN the valid fields should be ['phase']
    assert valid_fields == ["phase"]

    # GIVEN briefing phase
    valid_fields = get_valid_fields_for_phase("BRIEFING")
    # WHEN getting valid fields for briefing phase
    # THEN the valid fields should be ['phase']
    assert valid_fields == ["phase"]

    # GIVEN proof_of_value phase
    valid_fields = get_valid_fields_for_phase("PROOF_OF_VALUE")
    # WHEN getting valid fields for proof_of_value phase
    # THEN the valid fields should be ['phase', 'cancelled_after']
    assert valid_fields == ["phase", "cancelled_after",
                            "succeeded_after", "puzzles_solved",
                            "correct_rotations", "clicks_count"]

    # GIVEN market disclosure phase
    valid_fields = get_valid_fields_for_phase("MARKET_DISCLOSURE")
    # WHEN getting valid fields for disclosure phase
    # THEN the valid fields should be ['phase']
    assert valid_fields == ["phase"]

    # GIVEN job seeker disclosure phase
    valid_fields = get_valid_fields_for_phase("JOB_SEEKER_DISCLOSURE")
    # WHEN getting valid fields for job seeker disclosure phase
    # THEN the valid fields should be ['phase']
    assert valid_fields == ["phase"]

    # GIVEN perceived rank phase
    valid_fields = get_valid_fields_for_phase("PERCEIVED_RANK")
    # WHEN getting valid fields for perceived rank phase
    # THEN the valid fields should be ['phase', 'perceived_rank_percentile']
    assert valid_fields == ["phase", "perceived_rank_percentile"]

    # GIVEN retyped rank phase
    valid_fields = get_valid_fields_for_phase("RETYPED_RANK")
    # WHEN getting valid fields for retyped rank phase
    # THEN the valid fields should be ['phase', 'retyped_rank_percentile']
    assert valid_fields == ["phase", "retyped_rank_percentile"]

    # GIVEN cancelled phase
    valid_fields = get_valid_fields_for_phase("CANCELLED")
    # WHEN getting valid fields for cancelled phase
    # THEN the valid fields should be []
    assert valid_fields == []

    # GIVEN completed phase
    valid_fields = get_valid_fields_for_phase("COMPLETED")
    # WHEN getting valid fields for completed phase
    # THEN the valid fields should be []
    assert valid_fields == []
