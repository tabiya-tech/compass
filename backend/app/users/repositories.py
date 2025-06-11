import logging
from abc import ABC, abstractmethod

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections
from common_libs.time_utilities import datetime_to_mongo_date, get_now
from app.users.types import UserPreferences, UserPreferencesRepositoryUpdateRequest, Experiments, ExperimentConfig, UserExperiments

logger = logging.getLogger(__name__)


class UserPreferenceRepositoryError(Exception):
    """
    Custom exception for user preference repository errors.
    """

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class IUserPreferenceRepository(ABC):
    @abstractmethod
    async def get_user_preference_by_user_id(self, user_id) -> UserPreferences | None:
        """
        Get the user preferences by user_id
        :raises ValueError: if the user preferences are not valid
        :param user_id: str
            The user_id to search for
        :return: UserPreferences | None
            The user preferences if found, else None
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_experiments_by_user_id(self, user_id: str) -> Experiments:
        """
        Get the experiments for a user by user_id
        :param user_id: str - The user_id to get experiments for
        :return: Experiments - A dictionary mapping experiment namespaces to their configuration
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_experiments_by_user_ids(self, user_ids: list[str]) -> UserExperiments:
        """
        Get the experiments for multiple users by user_ids
        :param user_ids: list[str] - The user_ids to get experiments for
        :return: UserExperiments - A dictionary mapping user IDs to their corresponding experiments
                example {"user_id": {"experiment_namespace": "value" | {"config": "value"}}}
                returns an empty dict if no experiments are found for a user_id {"user_id": {}}
        """
        raise NotImplementedError()

    @abstractmethod
    async def set_experiment_by_user_id(self, user_id: str, experiment_id: str, experiment_config: ExperimentConfig) -> None:
        """
        Set an experiment configuration for a given experiment ID in the user preferences
        :param user_id: str - The user_id to set the experiment for
        :param experiment_id: str - The ID of the experiment
        :param experiment_config: ExperimentConfig - The configuration for the experiment (can be a simple string or a nested config)
        :return: None
        """
        raise NotImplementedError()

    @abstractmethod
    async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
        """
        Insert a new user preference
        :param user_id: str - The user_id to insert
        :param user_preference: UserPreferences - The user preferences to insert
        :return: UserPreferences
            The inserted user preferences
        """
        raise NotImplementedError()

    @abstractmethod
    async def update_user_preference(self, user_id: str,
                                     update: UserPreferencesRepositoryUpdateRequest) -> UserPreferences:
        """
        Update the user preferences by user_id
        :param user_id: str - The user_id to update
        :param update: UserPreferencesUpdateRequest - The update request
        :return: UserPreferences
            The updated user preferences
        :raises ValueError: if the user is not found - update failed
        """
        raise NotImplementedError()


class UserPreferenceRepository(IUserPreferenceRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.get_collection(Collections.USER_PREFERENCES)

    async def get_user_preference_by_user_id(self, user_id) -> UserPreferences | None:
        try:
            _doc = await self.collection.find_one({"user_id": {"$eq": user_id}})

            if not _doc:
                return None

            return UserPreferences.from_document(_doc)

        except Exception as e:
            logger.exception(e)
            raise UserPreferenceRepositoryError("Failed to get user preferences") from e

    async def get_experiments_by_user_id(self, user_id: str) -> Experiments:
        experiments = await self.get_experiments_by_user_ids([user_id])
        return experiments.get(user_id, {})

    async def get_experiments_by_user_ids(self, user_ids: list[str]) -> UserExperiments:
        try:
            # Convert list to set to remove duplicates
            unique_user_ids = set(user_ids)
            cursor = self.collection.find({"user_id": {"$in": list(unique_user_ids)}})
            docs = await cursor.to_list(length=None)

            if not docs:
                return {}

            experiments: UserExperiments = {}
            for doc in docs:
                if "experiments" not in doc:
                    doc["experiments"] = {}
                experiments[doc.get("user_id", None)] = UserPreferences.from_document(doc).experiments

            return experiments

        except Exception as e:
            logger.exception(e)
            raise UserPreferenceRepositoryError("Failed to get user experiments") from e

    async def set_experiment_by_user_id(self, user_id: str, experiment_id: str, experiment_config: ExperimentConfig) -> None:
        try:
            # Use $set with dot notation to update a specific field in the experiments dictionary
            await self.collection.update_one(
                {"user_id": {"$eq": user_id}},
                {"$set": {f"experiments.{experiment_id}": experiment_config}}
            )
        except Exception as e:
            logger.exception(e)
            raise UserPreferenceRepositoryError("Failed to set experiment") from e

    async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
        try:
            payload = user_preference.model_dump()
            payload["user_id"] = user_id
            payload["created_at"] = datetime_to_mongo_date(get_now())

            await self.collection.insert_one(payload)
            return await self.get_user_preference_by_user_id(user_id=user_id)
        except Exception as e:
            logger.exception(e)
            raise UserPreferenceRepositoryError("Failed to insert user preferences") from e

    async def update_user_preference(self, user_id: str,
                                     update: UserPreferencesRepositoryUpdateRequest) -> UserPreferences:
        try:
            payload = update.model_dump(exclude_none=True)

            await self.collection.update_one({"user_id": {"$eq": user_id}}, {"$set": payload})

            return await self.get_user_preference_by_user_id(user_id=user_id)
        except Exception as e:
            logger.exception(e)
            raise UserPreferenceRepositoryError("Failed to update user preferences") from e
