from abc import ABC, abstractmethod

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from modules.skills_ranking.repository.collections import Collections
from modules.skills_ranking.service.types import SkillRankingExperimentGroups, SkillsRankingPhase, SkillsRankingState


class ISkillsRankingRepository(ABC):
    @abstractmethod
    async def get_by_session_id(self, session_id: int) -> SkillsRankingState:
        """
        Get skills ranking state by session ID.
        :param session_id: conversation unique identifier
        :return: SkillsRankingState
        """
        raise NotImplementedError()

    @abstractmethod
    async def create(self, state: SkillsRankingState) -> SkillsRankingState:
        """
        Initialize a new skills ranking state.
        """
        raise NotImplementedError()

    @abstractmethod
    async def update(self, *, session_id: int, experiment_groups: SkillRankingExperimentGroups | None = None, phase: SkillsRankingPhase | None = None, ranking: str | None = None,
                     self_ranking: str | None = None) -> SkillsRankingState:
        """
        Updates an existing skills ranking state with the provided fields.
        
        :param session_id: The ID of the session to update (required)
        :param experiment_groups: Optional experiment group configuration to update
        :param phase: Optional phase to update the state to
        :param ranking: Optional ranking string to update
        :param self_ranking: Optional self-ranking string to update
        :return: The updated SkillsRankingState
        """
        raise NotImplementedError()


class SkillsRankingRepository(ISkillsRankingRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection(Collections.SKILLS_RANKING_STATE)

    async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
        _doc = await self._collection.find_one({
            "session_id": {
                "$eq": session_id
            }
        })

        if _doc is None:
            return None

        return SkillsRankingState(**_doc)

    async def create(self, state: SkillsRankingState) -> SkillsRankingState:
        _doc = state.model_dump()
        await self._collection.insert_one(_doc)
        return state

    # partial of skills ranking state
    async def update(self, *, session_id: int, experiment_groups: SkillRankingExperimentGroups | None = None, phase: SkillsRankingPhase | None = None, ranking: str | None = None,
                     self_ranking: str | None = None) -> SkillsRankingState:

        update_fields = {}
        if experiment_groups is not None:
            update_fields["experiment_groups"] = experiment_groups.model_dump()
        if phase is not None:
            update_fields["phase"] = phase.value
        if ranking is not None:
            update_fields["ranking"] = ranking
        if self_ranking is not None:
            update_fields["self_ranking"] = self_ranking

        updated_doc = await self._collection.find_one_and_update(
            {"session_id": session_id},
            {"$set": update_fields},
            return_document=ReturnDocument.AFTER
        )
        return SkillsRankingState(**updated_doc)
