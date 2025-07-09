from features.skills_ranking.service.types import SkillsRankingPhase


def get_possible_next_phase(current_phase: SkillsRankingPhase) -> list[SkillsRankingPhase]:
    """
    Returns the list of possible next phase based on the current phase.
    This is a more explicit and testable alternative to the phase navigation graph.
    
    Args:
        current_phase: The current phase of the skills ranking process
        
    Returns:
        List of possible next phases
    """
    if current_phase == "INITIAL":
        return ["BRIEFING"]

    if current_phase == "BRIEFING":
        return ["PROOF_OF_VALUE"]

    if current_phase == "PROOF_OF_VALUE":
        return ["MARKET_DISCLOSURE", "CANCELLED"]

    if current_phase == "MARKET_DISCLOSURE":
        return ["JOB_SEEKER_DISCLOSURE"]

    if current_phase == "JOB_SEEKER_DISCLOSURE":
        return ["PERCEIVED_RANK"]

    if current_phase == "DISCLOSURE":
        return ["PERCEIVED_RANK"]

    if current_phase == "PERCEIVED_RANK":
        return ["RETYPED_RANK"]

    if current_phase == "RETYPED_RANK":
        return ["COMPLETED"]

    # CANCELLED and COMPLETED are terminal states with no next states
    return []


def get_valid_fields_for_phase(phase: SkillsRankingPhase) -> list[str]:
    """
    Returns the list of valid fields for a given phase.

    Args:
        phase: The current phase of the skills ranking process

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
        return ["phase"]

    if phase == "JOB_SEEKER_DISCLOSURE":
        return ["phase"]

    if phase == "PERCEIVED_RANK":
        return ["phase", "perceived_rank_percentile"]

    if phase == "RETYPED_RANK":
        return ["phase", "retyped_rank_percentile"]

    # CANCELLED and COMPLETED phases do not have any valid fields to update
    return []
