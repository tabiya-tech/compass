from features.skills_ranking.service.types import SkillsRankingPhase


def get_possible_next_states(current_state: SkillsRankingPhase) -> list[SkillsRankingPhase]:
    """
    Returns the list of possible next states based on the current state.
    This is a more explicit and testable alternative to the state navigation graph.
    
    Args:
        current_state: The current state of the skills ranking process
        
    Returns:
        List of possible next states
    """
    if current_state == "INITIAL":
        return ["BRIEFING"]

    if current_state == "BRIEFING":
        return ["EFFORT"]

    if current_state == "EFFORT":
        return ["DISCLOSURE", "CANCELLED"]

    if current_state == "DISCLOSURE":
        return ["PERCEIVED_RANK"]

    if current_state == "PERCEIVED_RANK":
        return ["RETYPED_RANK"]

    if current_state == "RETYPED_RANK":
        return ["COMPLETED"]

    # CANCELLED and COMPLETED are terminal states with no next states
    return []
