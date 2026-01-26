import logging
from abc import ABC, abstractmethod

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.agent.experience import ExperienceEntity
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.server_dependencies.database_collections import Collections

# Maximum number of experiences to fetch in a single query to prevent memory exhaustion
MAX_EXPERIENCES_PER_QUERY = 10000


class IExperiencesRepository(ABC):
    """
    Interface for experiences repository.
    """
    @abstractmethod
    async def get_experiences_by_session_ids(
            self,
            session_ids: list[int]) -> dict[int, list[tuple[ExperienceEntity, DiveInPhase]]]:
        """
        Get all experiences for multiple session IDs.

        Args:
            session_ids: List of session IDs to retrieve experiences for

        Returns:
            A dictionary mapping session_id to a list of tuples (ExperienceEntity, DiveInPhase).
            Sessions without experiences are not included in the dictionary.
        """
        raise NotImplementedError


class ExperiencesRepository(IExperiencesRepository):
    """
    Custom exception for experiences repository errors.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)

    async def get_experiences_by_session_ids(
            self,
            session_ids: list[int]) -> dict[int, list[tuple[ExperienceEntity, DiveInPhase]]]:
        """
        Get all experiences for multiple session IDs in a single query.

        Args:
            session_ids: List of session IDs to retrieve experiences for

        Returns:
            A dictionary mapping session_id to a list of tuples (ExperienceEntity, DiveInPhase).
            Sessions without experiences are not included in the dictionary.

        Raises:
            ValueError: If session_ids contains invalid values (non-integers, negative numbers, or too many IDs)
        """
        # Input validation
        if not session_ids:
            return {}

        # Validate all session_ids are integers and non-negative
        if not all(isinstance(sid, int) and sid >= 0 for sid in session_ids):
            raise ValueError("session_ids must contain only non-negative integers")

        # Limit the number of session IDs to prevent excessive queries
        if len(session_ids) > 1000:
            raise ValueError(f"Cannot query more than 1000 session IDs at once (got {len(session_ids)})")

        # Query all documents at once using $in operator
        states = await self._collection.find(
            {"session_id": {"$in": session_ids}},
            {"session_id": 1, "experiences_state": 1, "_id": 0}
        ).to_list(length=MAX_EXPERIENCES_PER_QUERY)

        # Log warning if we hit the limit
        if len(states) >= MAX_EXPERIENCES_PER_QUERY:
            logging.getLogger(__name__).warning(
                "Hit maximum experiences limit of %s for batch query with %s session_ids",
                MAX_EXPERIENCES_PER_QUERY,
                len(session_ids)
            )

        # Create a mapping from session_id to experiences
        session_to_experiences: dict[int, list[tuple[ExperienceEntity, DiveInPhase]]] = {}

        for state_doc in states:
            session_id = state_doc.get("session_id")
            experiences_state_dict = state_doc.get("experiences_state", {})

            experiences_list: list[tuple[ExperienceEntity, DiveInPhase]] = []

            # Parse each experience from the experiences_state dictionary
            for experience_state_data in experiences_state_dict.values():
                try:
                    # Parse the dive_in_phase
                    dive_in_phase_str = experience_state_data.get("dive_in_phase")
                    dive_in_phase = DiveInPhase[dive_in_phase_str] if isinstance(dive_in_phase_str, str) \
                        else dive_in_phase_str

                    # Parse the experience entity
                    experience_data = experience_state_data.get("experience")
                    if experience_data:
                        experience_entity = ExperienceEntity(**experience_data)
                        experiences_list.append((experience_entity, dive_in_phase))
                except (KeyError, ValueError, TypeError) as e:
                    # Log error but continue processing other experiences
                    # This ensures partial data doesn't break the entire query
                    logging.getLogger(__name__).warning(
                        "Failed to parse experience for session_id %s: %s",
                        session_id, str(e)
                    )
                    continue

            session_to_experiences[session_id] = experiences_list

        return session_to_experiences
