from modules.skills_ranking.service.types import SkillsRankingPhase


def get_possible_next_states(current_state: SkillsRankingPhase) -> list[SkillsRankingPhase]:
    """
    Returns the list of possible next states based on the current state.
    This is a more explicit and testable alternative to the state navigation graph.
    
    Args:
        current_state: The current state of the skills ranking process
        
    Returns:
        List of possible next states
    """
    if current_state == SkillsRankingPhase.INITIAL:
        return [
            SkillsRankingPhase.SELF_EVALUATING,
            SkillsRankingPhase.SKIPPED,
        ]

    if current_state == SkillsRankingPhase.SELF_EVALUATING:
        return [SkillsRankingPhase.EVALUATED, SkillsRankingPhase.CANCELLED]

    # SKIPPED, CANCELLED and EVALUATED are terminal states with no next states
    return []
