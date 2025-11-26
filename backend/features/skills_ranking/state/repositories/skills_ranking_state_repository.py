from typing import Mapping

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from common_libs.time_utilities import datetime_to_mongo_date, mongo_date_to_datetime, get_now
from features.skills_ranking.state.repositories.types import ISkillsRankingStateRepository
from features.skills_ranking.state.services.type import (
    ApplicationWillingness,
    SkillRankingExperimentGroup,
    SkillsRankingState,
    SkillsRankingScore,
    SkillsRankingPhase,
    UpdateSkillsRankingRequest,
    ProcessMetadata,
    UserResponses,
    UserReassignmentMetadata,
)


class SkillsRankingStateRepository(ISkillsRankingStateRepository):
    def __init__(self, skills_ranking_state_db: AsyncIOMotorDatabase, collection_name: str):
        """
        Initialize the repository with a database provider.
        
        :param skills_ranking_state_db: A callable that returns an AsyncIOMotorDatabase
        """
        self._collection = skills_ranking_state_db.get_collection(collection_name)

    @classmethod
    def _to_db_doc(cls, skills_ranking_state: SkillsRankingState) -> Mapping:
        """
        Convert SkillsRankingState to a MongoDB document.

        :param skills_ranking_state: SkillsRankingState instance
        :return: Mapping representing the MongoDB document.
        """
        return {
            "session_id": skills_ranking_state.session_id,
            "phase": [
                {
                    "name": p.name,
                    "time": datetime_to_mongo_date(p.time)
                }
                for p in skills_ranking_state.phase
            ],
            "metadata": {
                "experiment_group": skills_ranking_state.metadata.experiment_group.name,
                "started_at": datetime_to_mongo_date(skills_ranking_state.metadata.started_at),
                "completed_at": datetime_to_mongo_date(
                    skills_ranking_state.metadata.completed_at) if skills_ranking_state.metadata.completed_at else None,
                "cancelled_after": skills_ranking_state.metadata.cancelled_after,
                "succeeded_after": skills_ranking_state.metadata.succeeded_after,
                "puzzles_solved": skills_ranking_state.metadata.puzzles_solved,
                "correct_rotations": skills_ranking_state.metadata.correct_rotations,
                "clicks_count": skills_ranking_state.metadata.clicks_count,
                "user_reassigned": skills_ranking_state.metadata.user_reassigned.model_dump()
                if skills_ranking_state.metadata.user_reassigned else None,
            },
            "score": {
                "calculated_at": datetime_to_mongo_date(skills_ranking_state.score.calculated_at),
                "above_average_labels": skills_ranking_state.score.above_average_labels,
                "below_average_labels": skills_ranking_state.score.below_average_labels,
                "most_demanded_label": skills_ranking_state.score.most_demanded_label,
                "most_demanded_percent": skills_ranking_state.score.most_demanded_percent,
                "least_demanded_label": skills_ranking_state.score.least_demanded_label,
                "least_demanded_percent": skills_ranking_state.score.least_demanded_percent,
                "average_percent_for_jobseeker_skill_groups": skills_ranking_state.score.average_percent_for_jobseeker_skill_groups,
                "average_count_for_jobseeker_skill_groups": skills_ranking_state.score.average_count_for_jobseeker_skill_groups,
                "province_used": skills_ranking_state.score.province_used,
                "matched_skill_groups": skills_ranking_state.score.matched_skill_groups,
            },
            "user_responses": {
                "prior_belief_percentile": skills_ranking_state.user_responses.prior_belief_percentile,
                "prior_belief_for_skill_percentile": skills_ranking_state.user_responses.prior_belief_for_skill_percentile,
                "perceived_rank_percentile": skills_ranking_state.user_responses.perceived_rank_percentile,
                "perceived_rank_for_skill_percentile": skills_ranking_state.user_responses.perceived_rank_for_skill_percentile,
                "application_willingness": skills_ranking_state.user_responses.application_willingness.model_dump() if skills_ranking_state.user_responses.application_willingness else None,
                "application_24h": skills_ranking_state.user_responses.application_24h,
                "opportunity_skill_requirement_percentile": skills_ranking_state.user_responses.opportunity_skill_requirement_percentile,
            }
        }

    @classmethod
    def _from_db_doc(cls, doc: Mapping) -> SkillsRankingState:
        """
       Convert a MongoDB document to SkillsRankingState.
       :param doc: MongoDB document
       :return: SkillsRankingState instance.
       """
        metadata_doc = doc["metadata"]
        user_responses_doc = doc.get("user_responses", {})

        experiment_group_value = metadata_doc["experiment_group"]
        try:
            experiment_group = SkillRankingExperimentGroup[experiment_group_value]
        except (KeyError, ValueError):
            raise ValueError(f"'{experiment_group_value}' is not a valid SkillRankingExperimentGroup")

        score_doc = doc.get("score", {})
        calculated_at = score_doc.get("calculated_at")

        """Helper to get score values or default"""
        def _get(score_key, default):
            value = score_doc.get(score_key, default)
            return value if value is not None else default

        return SkillsRankingState(
            session_id=doc["session_id"],
            phase=[
                SkillsRankingPhase(
                    name=p["name"],
                    time=mongo_date_to_datetime(p["time"])
                )
                for p in doc.get("phase", [])
            ],
            metadata=ProcessMetadata(
                experiment_group=experiment_group,
                started_at=mongo_date_to_datetime(metadata_doc["started_at"]),
                completed_at=mongo_date_to_datetime(metadata_doc["completed_at"]) if metadata_doc.get(
                    "completed_at") else None,
                cancelled_after=metadata_doc.get("cancelled_after"),
                succeeded_after=metadata_doc.get("succeeded_after"),
                puzzles_solved=metadata_doc.get("puzzles_solved"),
                correct_rotations=metadata_doc.get("correct_rotations"),
                clicks_count=metadata_doc.get("clicks_count"),
                user_reassigned=UserReassignmentMetadata(**metadata_doc["user_reassigned"])
                if metadata_doc.get("user_reassigned") else None,
            ),
            score=SkillsRankingScore(
                calculated_at=mongo_date_to_datetime(calculated_at) if calculated_at else get_now(),
                above_average_labels=score_doc.get("above_average_labels", []),
                below_average_labels=score_doc.get("below_average_labels", []),
                most_demanded_label=_get("most_demanded_label", ""),
                most_demanded_percent=_get("most_demanded_percent", 0.0),
                least_demanded_label=_get("least_demanded_label", ""),
                least_demanded_percent=_get("least_demanded_percent", 0.0),
                average_percent_for_jobseeker_skill_groups=_get("average_percent_for_jobseeker_skill_groups", 0.0),
                average_count_for_jobseeker_skill_groups=_get("average_count_for_jobseeker_skill_groups", 0.0),
                province_used=_get("province_used", ""),
                matched_skill_groups=_get("matched_skill_groups", 0),
            ),
            user_responses=UserResponses(
                prior_belief_percentile=user_responses_doc.get("prior_belief_percentile"),
                prior_belief_for_skill_percentile=user_responses_doc.get("prior_belief_for_skill_percentile"),
                perceived_rank_percentile=user_responses_doc.get("perceived_rank_percentile"),
                perceived_rank_for_skill_percentile=user_responses_doc.get("perceived_rank_for_skill_percentile"),
                application_willingness=ApplicationWillingness(
                    **user_responses_doc["application_willingness"]) if user_responses_doc.get(
                    "application_willingness") else None,
                application_24h=user_responses_doc.get("application_24h"),
                opportunity_skill_requirement_percentile=user_responses_doc.get(
                    "opportunity_skill_requirement_percentile"),
            )
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

    async def update(self, *, session_id: int, update_request: UpdateSkillsRankingRequest) -> SkillsRankingState:
        update_ops = {}
        set_fields = {}

        # Append new phase if provided
        if update_request.phase is not None:
            update_ops["$push"] = {
                "phase": {
                    "name": update_request.phase,
                    "time": datetime_to_mongo_date(get_now())
                }
            }

        if update_request.metadata is not None:
            for key, value in update_request.metadata.items():
                if key == "completed_at" and value is not None:
                    set_fields["metadata.completed_at"] = datetime_to_mongo_date(value)
                elif key == "experiment_group" and value is not None:
                    set_fields["metadata.experiment_group"] = value.name if hasattr(value, "name") else value
                elif key == "started_at" and value is not None:
                    set_fields["metadata.started_at"] = datetime_to_mongo_date(value)
                elif value is not None:
                    set_fields[f"metadata.{key}"] = value
                else:
                    set_fields[f"metadata.{key}"] = None

        if update_request.user_responses is not None:
            for key, value in update_request.user_responses.items():
                if key == "application_willingness" and value is not None:
                    set_fields["user_responses.application_willingness"] = value if isinstance(value,
                                                                                               dict) else value.model_dump()
                elif value is not None:
                    set_fields[f"user_responses.{key}"] = value
                else:
                    set_fields[f"user_responses.{key}"] = None

        if update_request.completed_at is not None:
            set_fields["metadata.completed_at"] = datetime_to_mongo_date(update_request.completed_at)

        if set_fields:
            update_ops["$set"] = set_fields

        if not update_ops:
            existing_doc = await self._collection.find_one({
                "session_id": session_id
            })
            return self._from_db_doc(existing_doc) if existing_doc else None

        updated_doc = await self._collection.find_one_and_update(
            {"session_id": session_id},
            update_ops,
            return_document=ReturnDocument.AFTER
        )

        return self._from_db_doc(updated_doc) if updated_doc else None
