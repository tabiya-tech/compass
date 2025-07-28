from abc import ABC, abstractmethod
from datetime import datetime
from typing import Mapping

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from common_libs.time_utilities import datetime_to_mongo_date, mongo_date_to_datetime, get_now
from features.skills_ranking.repository.collections import Collections
from features.skills_ranking.service.types import SkillRankingExperimentGroup, SkillsRankingState, SkillsRankingScore, \
    SkillsRankingPhase, UpdateSkillsRankingRequest


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
    async def update(self, *, session_id: int, update_request: UpdateSkillsRankingRequest) -> SkillsRankingState:
        """
        Updates an existing skills ranking state using a structured update request.
        
        :param session_id: The ID of the session to update (required)
        :param update_request: The structured update request containing the fields to update
        :return: The updated SkillsRankingState
        """
        raise NotImplementedError()


class SkillsRankingRepository(ISkillsRankingRepository):
    def __init__(self, skills_ranking_state_db: AsyncIOMotorDatabase):
        """
        Initialize the repository with a database provider.
        
        :param skills_ranking_state_db: A callable that returns an AsyncIOMotorDatabase
        """
        self._skills_ranking_state_db = skills_ranking_state_db

    @classmethod
    def _to_db_doc(cls, skills_ranking_state: SkillsRankingState) -> Mapping:
        """
        Convert SkillsRankingState to a MongoDB document.
        :param skills_ranking_state: SkillsRankingState instance
        :return: Mapping representing the MongoDB document
        """
        return {
            "session_id": skills_ranking_state.session_id,
            "experiment_group": skills_ranking_state.experiment_group.value,
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
            "completed_at": datetime_to_mongo_date(skills_ranking_state.completed_at) if skills_ranking_state.completed_at else None,
            "started_at": datetime_to_mongo_date(skills_ranking_state.started_at)
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
            experiment_group=SkillRankingExperimentGroup(doc["experiment_group"]),
            phase=[
                SkillsRankingPhase(
                    name=p["name"],
                    time=mongo_date_to_datetime(p["time"])
                )
                for p in doc["phase"]
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
            completed_at=mongo_date_to_datetime(doc["completed_at"]) if doc.get("completed_at") else None,
            started_at=mongo_date_to_datetime(doc["started_at"])
        )

    async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
        collection = self._skills_ranking_state_db.get_collection(Collections.SKILLS_RANKING_STATE)
        
        _doc = await collection.find_one({
            "session_id": {
                "$eq": session_id
            }
        })

        if _doc is None:
            return None

        return self._from_db_doc(_doc)

    async def create(self, state: SkillsRankingState) -> SkillsRankingState:
        collection = self._skills_ranking_state_db.get_collection(Collections.SKILLS_RANKING_STATE)
        
        _doc = self._to_db_doc(state)
        await collection.insert_one(_doc)
        return state

    async def update(self, *, session_id: int, update_request: UpdateSkillsRankingRequest) -> SkillsRankingState:
        collection = self._skills_ranking_state_db.get_collection(Collections.SKILLS_RANKING_STATE)
        
        update_ops = {}

        # Get all non-None fields from the update request
        update_dict = update_request.model_dump(exclude_none=True)
        
        # Handle field updates using $set
        set_fields = {}
        for field, value in update_dict.items():
            if field == "phase":
                # Skip phase as it's handled separately with $push
                continue
            elif field == "completed_at":
                # Convert datetime to MongoDB format
                set_fields[field] = datetime_to_mongo_date(value)
            else:
                set_fields[field] = value
        
        if set_fields:
            update_ops["$set"] = set_fields

        # Append new phase if provided
        if update_request.phase is not None:
            update_ops["$push"] = {
                "phase": {
                    "name": update_request.phase,
                    "time": datetime_to_mongo_date(get_now())
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
