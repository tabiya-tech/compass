from pydantic import BaseModel

from modules.skills_ranking.service.types import SkillsRankingPhase


class UpsertSkillsRankingRequest(BaseModel):
    """
    Upsert Skills Ranking Request — The request to upsert the skills ranking state.
    """
    phase: SkillsRankingPhase
    """
    The 
    """

    self_ranking: str | None = None
    """
    The self ranking of the skills ranking process.
    """


class GetRankingResponse(BaseModel):
    """
    Get Rank Response — The response of the skills ranking process.
    """

    ranking: str
    """
    The ranking of the skills ranking process.
    """
