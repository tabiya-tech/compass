"""
User Profile Repository

Provides access to user profile data aggregated from multiple collections:
- user_preferences (application_db): session IDs
- explore_experiences_director_state (application_db): explored experiences
- plain_personal_data (userdata_db): personal data from registration
"""

import logging
from abc import ABC, abstractmethod
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.agent.experience.experience_entity import ExperienceEntity
from app.server_dependencies.database_collections import Collections


class IUserProfileRepository(ABC):
    """
    Interface for the User Profile Repository.

    Allows mocking the repository in tests.
    """

    @abstractmethod
    async def get_latest_session_id(self, user_id: str) -> Optional[int]:
        """
        Get the latest session ID for a user.

        :param user_id: user_id
        :return: The latest session_id or None if no sessions exist
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_explored_experiences(self, session_id: int) -> Optional[list[dict]]:
        """
        Get explored experiences for a session.

        :param session_id: session_id
        :return: The list of explored experiences or None if not found/empty
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_explored_experience_entities(self, session_id: int) -> Optional[list[ExperienceEntity]]:
        """
        Get explored experiences for a session as ExperienceEntity objects with
        plain SkillEntity skills (tuple wrapping stripped).

        :param session_id: session_id
        :return: A list of ExperienceEntity, or None if no experiences exist
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_personal_data(self, user_id: str) -> Optional[dict]:
        """
        Get personal data for a user.

        :param user_id: user_id
        :return: The personal data dict or None if not found
        """
        raise NotImplementedError()


class UserProfileRepository(IUserProfileRepository):
    """Concrete implementation that reads from application_db and userdata_db."""

    def __init__(self, application_db: AsyncIOMotorDatabase, userdata_db: AsyncIOMotorDatabase):
        self._application_db = application_db
        self._userdata_db = userdata_db
        self._user_preferences_collection = application_db.get_collection(Collections.USER_PREFERENCES)
        self._explore_experiences_collection = application_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        self._plain_personal_data_collection = userdata_db.get_collection(Collections.PLAIN_PERSONAL_DATA)
        self._logger = logging.getLogger(UserProfileRepository.__name__)

    async def get_latest_session_id(self, user_id: str) -> Optional[int]:
        # Use $eq to prevent NoSQL injection
        _doc = await self._user_preferences_collection.find_one(
            {"user_id": {"$eq": user_id}},
            {"sessions": 1, "_id": 0}
        )

        if _doc is None:
            return None

        sessions = _doc.get("sessions", [])
        if not sessions:
            return None

        # Sessions can be stored as strings or integers, normalize to int
        latest = sessions[-1]
        try:
            return int(latest)
        except (ValueError, TypeError):
            self._logger.warning("Could not convert session_id to int: %s", latest)
            return None

    async def get_explored_experiences(self, session_id: int) -> Optional[list[dict]]:
        # Use $eq to prevent NoSQL injection
        _doc = await self._explore_experiences_collection.find_one(
            {"session_id": {"$eq": session_id}},
            {"explored_experiences": 1, "_id": 0}
        )

        if _doc is None:
            return None

        explored_experiences = _doc.get("explored_experiences", [])
        if not explored_experiences:
            return None

        return explored_experiences

    async def get_explored_experience_entities(self, session_id: int) -> Optional[list[ExperienceEntity]]:
        # The Mongo doc stores top_skills/remaining_skills as [(score, skill), ...] tuples
        # (see app/agent/experience/upgrade_experience.py). Strip the tuple wrapping before
        # validation so the entity matches its declared schema (list[SkillEntity]).
        raw = await self.get_explored_experiences(session_id)
        if not raw:
            return None
        entities: list[ExperienceEntity] = []
        for exp_dict in raw:
            normalized = {**exp_dict}
            for key in ("top_skills", "remaining_skills"):
                skills = normalized.get(key) or []
                if skills and isinstance(skills[0], (list, tuple)):
                    normalized[key] = [skill for _, skill in skills]
            entities.append(ExperienceEntity.model_validate(normalized))
        return entities

    async def get_personal_data(self, user_id: str) -> Optional[dict]:
        # Use $eq to prevent NoSQL injection
        _doc = await self._plain_personal_data_collection.find_one(
            {"user_id": {"$eq": user_id}},
            {"data": 1, "_id": 0}
        )

        if _doc is None:
            return None

        return _doc.get("data", None)
