from typing import Optional

from pydantic import BaseModel

from modules.skills_ranking.service.types import SkillsRankingState, SkillsRankingCurrentState


class SkillsRankingResponse(SkillsRankingState):
    """
    Skills Ranking Response — The response of the skills ranking process.
    """

    class Config:
        use_enum_values = True

    @staticmethod
    def from_state(state: SkillsRankingState) -> "SkillsRankingResponse":
        """
        Create a GetSkillsRankingResponse from a SkillsRankingState.
        :param state: SkillsRankingState
        :return: GetSkillsRankingResponse.
        """
        return SkillsRankingResponse(
            session_id=state.session_id,
            experiment_groups=state.experiment_groups,
            current_state=state.current_state,
            ranking=state.ranking,
            self_ranking=state.self_ranking,
        )


class UpsertSkillsRankingRequest(BaseModel):
    """
    Upsert Skills Ranking Request — The request to upsert the skills ranking state.
    """

    current_state: SkillsRankingCurrentState
    """
    The current state of the skills ranking process.
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
