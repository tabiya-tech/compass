from app.conversations.skills_ranking.service.types import SkillsRankingCurrentState


def get_possible_next_states(current_state: SkillsRankingCurrentState) -> list[SkillsRankingCurrentState]:
    """
    Returns the list of possible next states based on the current state.
    This is a more explicit and testable alternative to the state navigation graph.
    
    Args:
        current_state: The current state of the skills ranking process
        
    Returns:
        List of possible next states
    """
    if current_state == SkillsRankingCurrentState.INITIAL:
        return [
            SkillsRankingCurrentState.SELF_EVALUATING,
            SkillsRankingCurrentState.SKIPPED,
        ]
    
    if current_state == SkillsRankingCurrentState.SELF_EVALUATING:
        return [SkillsRankingCurrentState.EVALUATED]
    
    # Both SKIPPED and EVALUATED are terminal states with no next states
    return [] 