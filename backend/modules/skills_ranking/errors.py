from modules.skills_ranking.service.types import SkillsRankingPhase


class SkillsRankingStateNotFound(Exception):
    """Skills Ranking State Not Found in the store"""

    def __init__(self, session_id: int):
        self.session_id = session_id
        super().__init__(f"Skills ranking state not found for session_id: {session_id}")


class InvalidNewPhaseError(Exception):
    """Invalid new phase error"""

    def __init__(self, current_phase: SkillsRankingPhase, expected_phases: list[SkillsRankingPhase]):
        self.current_phase = current_phase
        self.expected_phases = expected_phases
        super().__init__(f"Invalid new phase: {current_phase}. Expected one of: {expected_phases}")


class InvalidSkillsRankingInitializationRequest(Exception):
    """Invalid Skills Ranking Initialization Request"""

    def __init__(self, session_id: int):
        self.session_id = session_id
        super().__init__(f"Invalid Skills Ranking Initialization Request for session_id: {session_id}")
