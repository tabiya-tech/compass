from abc import ABC, abstractmethod
from datetime import datetime
from typing import Mapping

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from common_libs.time_utilities import datetime_to_mongo_date, mongo_date_to_datetime
from features.skills_ranking.repository.collections import Collections
from features.skills_ranking.service.types import SkillRankingExperimentGroup, SkillsRankingPhase, SkillsRankingState, SkillsRankingScore


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
    async def update(self, *,
                     session_id: int,
                     phase: SkillsRankingPhase | None = None,
                     cancelled_after: str | None = None,
                     perceived_rank_percentile: float | None = None,
                     retyped_rank_percentile: float | None = None,
                     completed_at: datetime | None = None
                     ) -> SkillsRankingState:
        """
        Updates an existing skills ranking state with the provided fields.
        
        :param perceived_rank_percentile: The percentile rank the user thinks they have (0-100)
        :param retyped_rank_percentile: The rank the user retyped to confirm they saw it correctly (0-100)
        :param cancelled_after: The proof_of_value spent by the user before they cancelled the skills ranking process.
        :param session_id: The ID of the session to update (required)
        :param phase: Optional phase to update the state to
        :param completed_at: Optional completion time to set for the state
        :return: The updated SkillsRankingState
        """
        raise NotImplementedError()


class SkillsRankingRepository(ISkillsRankingRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection(Collections.SKILLS_RANKING_STATE)

    @classmethod
    def _to_db_doc(cls, skills_ranking_state: SkillsRankingState) -> Mapping:
        """
        Convert SkillsRankingState to a MongoDB document.
        :param skills_ranking_state: SkillsRankingState instance
        :return: Mapping representing the MongoDB document
        """
        return {
            "session_id": skills_ranking_state.session_id,
            "experiment_group": skills_ranking_state.experiment_group.name,
            "phase": skills_ranking_state.phase,
            "score": {
                "calculated_at": datetime_to_mongo_date(skills_ranking_state.score.calculated_at),
                "jobs_matching_rank": skills_ranking_state.score.jobs_matching_rank,
                "comparison_rank": skills_ranking_state.score.comparison_rank,
                "comparison_label": skills_ranking_state.score.comparison_label
            },
            "cancelled_after": skills_ranking_state.cancelled_after,
            "succeeded_after": skills_ranking_state.succeeded_after,
            "puzzles_solved": skills_ranking_state.puzzles_solved,
            "correct_rotations": skills_ranking_state.correct_rotations,
            "clicks_count": skills_ranking_state.clicks_count,
            "perceived_rank_percentile": skills_ranking_state.perceived_rank_percentile,
            "retyped_rank_percentile": skills_ranking_state.retyped_rank_percentile,
            "started_at": datetime_to_mongo_date(skills_ranking_state.started_at),
            "completed_at": datetime_to_mongo_date(skills_ranking_state.completed_at) if skills_ranking_state.completed_at else None
        }

    @classmethod
    def _from_db_doc(cls, doc: Mapping) -> SkillsRankingState:
        """
        Convert a MongoDB document to SkillsRankingState.
        :param doc: MongoDB document
        :return: SkillsRankingState instance
        """
        return SkillsRankingState(
            session_id=doc["session_id"],
            experiment_group=SkillRankingExperimentGroup[doc["experiment_group"]],
            phase=doc["phase"],
            score=SkillsRankingScore(
                calculated_at=mongo_date_to_datetime(doc["score"]["calculated_at"]),
                jobs_matching_rank=doc["score"]["jobs_matching_rank"],
                comparison_rank=doc["score"]["comparison_rank"],
                comparison_label=doc["score"]["comparison_label"]
            ),
            cancelled_after=doc.get("cancelled_after"),
            perceived_rank_percentile=doc.get("perceived_rank_percentile"),
            retyped_rank_percentile=doc.get("retyped_rank_percentile"),
            started_at=mongo_date_to_datetime(doc["started_at"]),
            completed_at=mongo_date_to_datetime(doc.get("completed_at")) if doc.get("completed_at") else None
        )

    async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
        _doc = await self._collection.find_one({
            "session_id": {
                "$eq": session_id
            }
        })

        if _doc is None:
            return None

        return self._from_db_doc(_doc)

    async def create(self, state: SkillsRankingState) -> SkillsRankingState:
        _doc = self._to_db_doc(state)
        await self._collection.insert_one(_doc)
        return state

    # partial of skills ranking state
    async def update(self, *,
                     session_id: int,
                     phase: SkillsRankingPhase | None = None,
                     cancelled_after: float | None = None,
                     perceived_rank_percentile: float | None = None,
                     retyped_rank_percentile: float | None = None,
                     completed_at: datetime | None = None
                     ) -> SkillsRankingState:

        update_fields = {}
        if phase is not None:
            update_fields["phase"] = phase
        if cancelled_after is not None:
            update_fields["cancelled_after"] = cancelled_after
        if perceived_rank_percentile is not None:
            update_fields["perceived_rank_percentile"] = perceived_rank_percentile
        if retyped_rank_percentile is not None:
            update_fields["retyped_rank_percentile"] = retyped_rank_percentile
        if completed_at is not None:
            update_fields["completed_at"] = datetime_to_mongo_date(completed_at)

        updated_doc = await self._collection.find_one_and_update(
            {"session_id": {"$eq": session_id}},
            {"$set": update_fields},
            return_document=ReturnDocument.AFTER
        )
        return self._from_db_doc(updated_doc) if updated_doc else None
