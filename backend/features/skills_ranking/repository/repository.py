from abc import ABC, abstractmethod
from datetime import datetime
from typing import Mapping

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from common_libs.time_utilities import datetime_to_mongo_date, mongo_date_to_datetime
from features.skills_ranking.repository.collections import Collections
from features.skills_ranking.service.types import SkillRankingExperimentGroup, SkillsRankingPhaseName, SkillsRankingState, SkillsRankingScore, \
    SkillsRankingPhase


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
                     succeeded_after: str | None = None,
                     puzzles_solved: int | None = None,
                     correct_rotations: int | None = None,
                     clicks_count: int | None = None,
                     completed_at: datetime | None = None
                     ) -> SkillsRankingState:
        """
        Updates an existing skills ranking state with the provided fields.
        
        :param perceived_rank_percentile: The percentile rank the user thinks they have (0-100)
        :param retyped_rank_percentile: The rank the user retyped to confirm they saw it correctly (0-100)
        :param cancelled_after: The proof_of_value spent by the user before they cancelled the skills ranking process.
        :param succeeded_after: The proof_of_value spent by the user after they succeeded in the skills ranking process.
        :param puzzles_solved: The number of puzzles the user solved for the proof_of_value task
        :param correct_rotations: The number of characters the user rotated correctly for the proof_of_value task
        :param clicks_count: The number of clicks the user made during the proof_of_value task
        :param session_id: The ID of the session to update (required)
        :param phase: Optional phase to update the state to
        :param completed_at: Optional completion time to set for the state
        :return: The updated SkillsRankingState
        """
        raise NotImplementedError()


class SkillsRankingRepository(ISkillsRankingRepository):
    def __init__(self, db_provider):
        """
        Initialize the repository with a database provider.
        
        :param db_provider: A callable that returns an AsyncIOMotorDatabase
        """
        self._db_provider = db_provider

    async def _get_db(self) -> AsyncIOMotorDatabase:
        """Get the skills ranking database from the injected provider."""
        return await self._db_provider()

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
            "phase": [
                {
                    "name": p.name,
                    "time": datetime_to_mongo_date(p.time)
                }
                for p in skills_ranking_state.phase
            ],
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
            phase=[
                SkillsRankingPhase(
                    name=p["name"],
                    time=mongo_date_to_datetime(p["time"])
                ) for p in doc["phase"]
            ],
            score=SkillsRankingScore(
                calculated_at=mongo_date_to_datetime(doc["score"]["calculated_at"]),
                jobs_matching_rank=doc["score"]["jobs_matching_rank"],
                comparison_rank=doc["score"]["comparison_rank"],
                comparison_label=doc["score"]["comparison_label"]
            ),
            cancelled_after=doc.get("cancelled_after"),
            succeeded_after=doc.get("succeeded_after"),
            puzzles_solved=doc.get("puzzles_solved"),
            correct_rotations=doc.get("correct_rotations"),
            clicks_count=doc.get("clicks_count"),
            perceived_rank_percentile=doc.get("perceived_rank_percentile"),
            retyped_rank_percentile=doc.get("retyped_rank_percentile"),
            started_at=mongo_date_to_datetime(doc["started_at"]),
            completed_at=mongo_date_to_datetime(doc.get("completed_at")) if doc.get("completed_at") else None
        )

    async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
        db = await self._get_db()
        collection = db.get_collection(Collections.SKILLS_RANKING_STATE)
        
        _doc = await collection.find_one({
            "session_id": {
                "$eq": session_id
            }
        })

        if _doc is None:
            return None

        return self._from_db_doc(_doc)

    async def create(self, state: SkillsRankingState) -> SkillsRankingState:
        db = await self._get_db()
        collection = db.get_collection(Collections.SKILLS_RANKING_STATE)
        
        _doc = self._to_db_doc(state)
        await collection.insert_one(_doc)
        return state

    # partial of skills ranking state
    async def update(
            self,
            *,
            session_id: int,
            phase: SkillsRankingPhase | None = None,
            cancelled_after: str | None = None,
            perceived_rank_percentile: float | None = None,
            retyped_rank_percentile: float | None = None,
            succeeded_after: str | None = None,
            puzzles_solved: int | None = None,
            correct_rotations: int | None = None,
            clicks_count: int | None = None,
            completed_at: datetime | None = None,
    ) -> SkillsRankingState:
        db = await self._get_db()
        collection = db.get_collection(Collections.SKILLS_RANKING_STATE)
        
        update_ops = {}

        # Handle other field updates using $set
        set_fields = {}
        if cancelled_after is not None:
            set_fields["cancelled_after"] = cancelled_after
        if perceived_rank_percentile is not None:
            set_fields["perceived_rank_percentile"] = perceived_rank_percentile
        if retyped_rank_percentile is not None:
            set_fields["retyped_rank_percentile"] = retyped_rank_percentile
        if succeeded_after is not None:
            set_fields["succeeded_after"] = succeeded_after
        if puzzles_solved is not None:
            set_fields["puzzles_solved"] = puzzles_solved
        if correct_rotations is not None:
            set_fields["correct_rotations"] = correct_rotations
        if clicks_count is not None:
            set_fields["clicks_count"] = clicks_count
        if completed_at is not None:
            set_fields["completed_at"] = datetime_to_mongo_date(completed_at)
        if set_fields:
            update_ops["$set"] = set_fields

        # Append new phase if provided
        if phase is not None:
            update_ops["$push"] = {
                "phase": {
                    "name": phase.name,
                    "time": datetime_to_mongo_date(phase.time)
                }
            }

        if not update_ops:
            return self._from_db_doc(await collection.find_one({"session_id": session_id}))

        updated_doc = await collection.find_one_and_update(
            {"session_id": session_id},
            update_ops,
            return_document=ReturnDocument.AFTER
        )

        return self._from_db_doc(updated_doc) if updated_doc else None
