import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections

from app.users.types import UserPreferences, UserPreferencesRepositoryUpdateRequest

logger = logging.getLogger(__name__)


class UserPreferenceRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.get_collection(Collections.USER_PREFERENCES)

    async def get_user_preference_by_user_id(self, user_id) -> UserPreferences | None:
        """
        Get the user preferences by user_id
        :raises ValueError: if the user preferences are not valid
        :param user_id: str
            The user_id to search for
        :return: UserPreferences | None
            The user preferences if found, else None
        """
        try:
            _doc = await self.collection.find_one({"user_id": {"$eq": user_id}})

            if not _doc:
                return None

            return UserPreferences.from_document(_doc)

        except Exception as e:
            logger.exception(e)
            raise Exception("Failed to get user preferences")

    async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
        """
        Insert a new user preference
        :param user_id: str - The user_id to insert
        :param user_preference: UserPreferences - The user preferences to insert
        :return: UserPreferences
            The inserted user preferences
        """
        try:
            payload = user_preference.model_dump()
            payload["user_id"] = user_id

            _doc = await self.collection.insert_one(payload)
            return await self.get_user_preference_by_user_id(user_id=user_id)
        except Exception as e:
            logger.exception(e)
            raise e

    async def update_user_preference(self, user_id: str, update: UserPreferencesRepositoryUpdateRequest) -> UserPreferences:
        """
        Update the user preferences by user_id
        :param user_id: str - The user_id to update
        :param update: UserPreferencesUpdateRequest - The update request
        :return: UserPreferences
            The updated user preferences
        :raises ValueError: if the user is not found - update failed
        """
        try:
            payload = update.model_dump(exclude_none=True)

            print(payload)

            _doc = await self.collection.update_one({"user_id": {"$eq": user_id}}, {"$set": payload})

            return await self.get_user_preference_by_user_id(user_id=user_id)
        except Exception as e:
            logger.exception(e)
            raise e
