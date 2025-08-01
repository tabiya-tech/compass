from features.skills_ranking.utils import get_possible_next_phase, get_valid_fields_for_phase


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


def test_get_valid_fields_for_phase():
    """Test that get_valid_fields_for_phase returns the correct fields for each phase."""
    # Test basic phase validation
    assert get_valid_fields_for_phase("INITIAL") == ["phase"]
    assert get_valid_fields_for_phase("BRIEFING") == ["phase"]
    assert get_valid_fields_for_phase("PROOF_OF_VALUE") == ["phase", "cancelled_after", "succeeded_after", "puzzles_solved", "correct_rotations", "clicks_count"]
    assert get_valid_fields_for_phase("MARKET_DISCLOSURE") == ["phase"]
    assert get_valid_fields_for_phase("JOB_SEEKER_DISCLOSURE") == ["phase"]
    assert get_valid_fields_for_phase("PERCEIVED_RANK") == ["phase", "perceived_rank_percentile"]
    assert get_valid_fields_for_phase("RETYPED_RANK") == ["phase", "retyped_rank_percentile"]
    assert get_valid_fields_for_phase("COMPLETED") == []

    # Test transition-specific validation
    # When transitioning from PROOF_OF_VALUE to MARKET_DISCLOSURE, allow metrics fields
    assert get_valid_fields_for_phase("MARKET_DISCLOSURE", from_phase="PROOF_OF_VALUE") == [
        "phase", "cancelled_after", "succeeded_after", "puzzles_solved", "correct_rotations", "clicks_count"
    ]
    
    # When transitioning from PERCEIVED_RANK to RETYPED_RANK, allow both perceived and retyped rank
    assert get_valid_fields_for_phase("RETYPED_RANK", from_phase="PERCEIVED_RANK") == [
        "phase", "perceived_rank_percentile", "retyped_rank_percentile"
    ]
    
    # When transitioning from RETYPED_RANK to COMPLETED, allow both perceived and retyped rank
    assert get_valid_fields_for_phase("COMPLETED", from_phase="RETYPED_RANK") == [
        "phase", "perceived_rank_percentile", "retyped_rank_percentile"
    ]
    
    # When not transitioning from PROOF_OF_VALUE, MARKET_DISCLOSURE only allows phase
    assert get_valid_fields_for_phase("MARKET_DISCLOSURE", from_phase="BRIEFING") == ["phase"]
    assert get_valid_fields_for_phase("MARKET_DISCLOSURE", from_phase=None) == ["phase"]
    
    # When not transitioning from PERCEIVED_RANK, RETYPED_RANK only allows retyped_rank_percentile
    assert get_valid_fields_for_phase("RETYPED_RANK", from_phase="BRIEFING") == ["phase", "retyped_rank_percentile"]
    assert get_valid_fields_for_phase("RETYPED_RANK", from_phase=None) == ["phase", "retyped_rank_percentile"]
    
    # When not transitioning from RETYPED_RANK, COMPLETED allows no fields
    assert get_valid_fields_for_phase("COMPLETED", from_phase="BRIEFING") == []
    assert get_valid_fields_for_phase("COMPLETED", from_phase=None) == []
