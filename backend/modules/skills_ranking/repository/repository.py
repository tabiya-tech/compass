from abc import ABC, abstractmethod
from typing import Mapping, Any, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from modules.skills_ranking.repository.collections import Collections
from modules.skills_ranking.service.types import SkillsRankingState, SkillsRankingCurrentState


def _to_db_doc(state: SkillsRankingState) -> dict:
    # use the Mode JSON to serialize Enums into strings for better MongoDB compatibility.
    state_dict = state.model_dump(mode="json")
    return state_dict


def _from_db_doc(doc: Mapping[str, Any]) -> SkillsRankingState:
    return SkillsRankingState(**doc)


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
    async def update(self, state: SkillsRankingState) -> SkillsRankingState:
        """
        Updates an existing state
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

        return _from_db_doc(_doc)

    async def create(self, state: SkillsRankingState) -> SkillsRankingState:
        _doc = _to_db_doc(state)
        await self._collection.insert_one(_doc)
        return state

    async def update(self, state: SkillsRankingState):
        _doc = _to_db_doc(state)
        _doc.pop("session_id")

        updated_doc = await self._collection.find_one_and_update(
            {"session_id": state.session_id},
            {"$set": _doc},
            return_document=ReturnDocument.AFTER
        )
        return SkillsRankingState(**updated_doc)