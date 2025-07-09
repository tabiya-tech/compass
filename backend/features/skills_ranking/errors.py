from features.skills_ranking.service.types import SkillsRankingPhase


class SkillsRankingStateNotFound(Exception):
    """
    Skill Ranking State Not Found in the store
    """

    def __init__(self, session_id: int):
        self.session_id = session_id
        super().__init__(f"Skills ranking state not found for session_id: {session_id}")


class InvalidNewPhaseError(Exception):
    """Invalid new phase error"""

    def __init__(self, current_phase: SkillsRankingPhase, expected_phases: list[SkillsRankingPhase]):
        self.current_phase = current_phase
        self.expected_phases = expected_phases
        super().__init__(f"Invalid new phase: {current_phase}. Expected one of: {expected_phases}")


class InvalidFieldsForPhaseError(Exception):
    """Invalid fields for phase error"""

    def __init__(self, current_phase: SkillsRankingPhase, invalid_fields: list[str], valid_fields: list[str]):
        self.current_phase = current_phase
        self.invalid_fields = invalid_fields
        self.valid_fields = valid_fields
        super().__init__(f"Invalid fields for phase '{current_phase}': {invalid_fields}. "
                         f"Valid fields are: {valid_fields}")
