from pydantic import BaseModel

from features.skills_ranking.service.types import SkillsRankingPhase


class UpsertSkillsRankingRequest(BaseModel):
    """
    Upsert Skills Ranking Request — The request to upsert the skills ranking state.
    """
    phase: SkillsRankingPhase
    """
    The phase of the skills ranking process.
    """
    cancelled_after: str | None = None
    """
    Represents the effort spent by the user before they cancelled the skills ranking process.
    """
    perceived_rank_percentile: float | None = None
    """
    The percentile rank the user thinks they have (0-100).
    """
    retyped_rank_percentile: float | None = None
    """
    The rank the user retyped to confirm they saw it correctly (0-100).
    """