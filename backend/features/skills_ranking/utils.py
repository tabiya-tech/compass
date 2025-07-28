from features.skills_ranking.service.types import SkillsRankingPhaseName


def get_possible_next_phase(current_phase: SkillsRankingPhaseName) -> list[SkillsRankingPhaseName]:
    """
    Returns the list of possible next phase based on the current phase.
    This is a more explicit and testable alternative to the phase navigation graph.
    
    Args:
        current_phase: The current phase of the skills ranking process
        
    Returns:
        List of possible next phases (including the current phase for metrics-only updates)
    """
    if current_phase == "INITIAL":
        return ["INITIAL", "BRIEFING"]

    if current_phase == "BRIEFING":
        return ["BRIEFING", "PROOF_OF_VALUE"]

    if current_phase == "PROOF_OF_VALUE":
        return ["PROOF_OF_VALUE", "MARKET_DISCLOSURE"]

    if current_phase == "MARKET_DISCLOSURE":
        return ["MARKET_DISCLOSURE", "JOB_SEEKER_DISCLOSURE"]

    if current_phase == "JOB_SEEKER_DISCLOSURE":
        return ["JOB_SEEKER_DISCLOSURE", "PERCEIVED_RANK"]

    if current_phase == "DISCLOSURE":
        return ["DISCLOSURE", "PERCEIVED_RANK"]

    if current_phase == "PERCEIVED_RANK":
        return ["PERCEIVED_RANK", "RETYPED_RANK"]

    if current_phase == "RETYPED_RANK":
        return ["RETYPED_RANK", "COMPLETED"]

    # COMPLETED is a terminal state with no next states, but allows same phase for metrics updates
    if current_phase == "COMPLETED":
        return ["COMPLETED"]

    # Fallback - should not reach here
    return []


def get_valid_fields_for_phase(phase: SkillsRankingPhaseName, from_phase: SkillsRankingPhaseName | None = None) -> list[str]:
    """
    Returns the list of valid fields for a given phase.

    Args:
        phase: The current phase of the skills ranking process
        from_phase: The phase we're transitioning from (for transition-specific validation)

    Returns:
        List of valid fields for the given phase
    """
    if phase == "INITIAL":
        return ["phase"]

    if phase == "BRIEFING":
        return ["phase"]

    if phase == "PROOF_OF_VALUE":
        return ["phase", "cancelled_after", "succeeded_after", "puzzles_solved", "correct_rotations", "clicks_count"]

    if phase == "MARKET_DISCLOSURE":
        # Allow metrics fields when transitioning from PROOF_OF_VALUE (for cancellation/completion)
        if from_phase == "PROOF_OF_VALUE":
            return ["phase", "cancelled_after", "succeeded_after", "puzzles_solved", "correct_rotations", "clicks_count"]
        return ["phase"]

    if phase == "JOB_SEEKER_DISCLOSURE":
        return ["phase"]

    if phase == "PERCEIVED_RANK":
        return ["phase", "perceived_rank_percentile"]

    if phase == "RETYPED_RANK":
        # Allow perceived_rank_percentile when transitioning from PERCEIVED_RANK
        if from_phase == "PERCEIVED_RANK":
            return ["phase", "perceived_rank_percentile", "retyped_rank_percentile"]
        return ["phase", "retyped_rank_percentile"]

    if phase == "COMPLETED":
        # Allow both perceived and retyped rank when transitioning from RETYPED_RANK
        if from_phase == "RETYPED_RANK":
            return ["phase", "perceived_rank_percentile", "retyped_rank_percentile"]
        return []

    # COMPLETED phase does not have any valid fields to update
    return []
