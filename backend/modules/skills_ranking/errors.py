from modules.skills_ranking.service.types import SkillsRankingCurrentState


class SkillsRankingStateNotFound(Exception):
    """Skills Ranking State Not Found in the store"""


class InvalidNewPhaseError(Exception):
    """Invalid new phase for the skills ranking process"""
    def __init__(self, current_phase: SkillsRankingCurrentState, expected_phases: list[SkillsRankingCurrentState]):
        self.current_phase = current_phase
        self.expected_phases = expected_phases
