from features.skills_ranking.state.services.type import SkillsRankingPhaseName


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
        return ["PROOF_OF_VALUE", "MARKET_DISCLOSURE", "JOB_SEEKER_DISCLOSURE"]

    if current_phase == "MARKET_DISCLOSURE":
        return ["MARKET_DISCLOSURE", "JOB_SEEKER_DISCLOSURE"]

    if current_phase == "JOB_SEEKER_DISCLOSURE":
        return ["JOB_SEEKER_DISCLOSURE", "PERCEIVED_RANK"]

    if current_phase == "PERCEIVED_RANK":
        return ["PERCEIVED_RANK", "RETYPED_RANK", "COMPLETED"]

    if current_phase == "RETYPED_RANK":
        return ["RETYPED_RANK", "COMPLETED"]

    # COMPLETED is a terminal state with no next states, but allows same phase for metrics updates
    if current_phase == "COMPLETED":
        return ["COMPLETED"]

    # Fallback - should not reach here
    return []