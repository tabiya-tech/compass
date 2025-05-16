from modules.skills_ranking.service.types import SkillsRankingCurrentState


class SkillsRankingStateNotFound(Exception):
    """Skills Ranking State Not Found in the store"""
    def __init__(self, session_id: int):
        self.session_id = session_id
        super().__init__(f"Skills ranking state not found for session_id: {session_id}")


class InvalidNewPhaseError(Exception):
    """Invalid new phase error"""
    def __init__(self, current_phase: SkillsRankingCurrentState, expected_phases: list[SkillsRankingCurrentState]):
        self.current_phase = current_phase
        self.expected_phases = expected_phases
        super().__init__(f"Invalid new phase: {current_phase}. Expected one of: {expected_phases}")


class ExperimentGroupsNotFound(Exception):
    """Experiment groups not found"""
    def __init__(self, user_id: int, session_id: int):
        self.user_id = user_id
        self.session_id = session_id
        super().__init__(f"Experiment groups not found for user_id: {user_id} and session_id: {session_id}")
