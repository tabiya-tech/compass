from app.server_dependencies import get_mongo_db
from app.constants.database import Collections

from app.users.types import UserPreferences, UserPreferencesUpdateRequest


class UserPreferenceRepository:
    def __init__(self):
        self.collection = get_mongo_db().get_collection(Collections.USER_PREFERENCES)

    async def get_user_preference_by_user_id(self, user_id) -> UserPreferences | None:
        """
        Get the user preferences by user_id
        :raises ValueError: if the user preferences are not valid
        :param user_id: str
            The user_id to search for
        :return: UserPreferences | None
            The user preferences if found, else None
        """
        _doc = await self.collection.find_one({"user_id": {"$eq": user_id}})

        if not _doc:
            return None

        try:
            return UserPreferences(**_doc) if _doc else None
        except ValueError as e:
            print(e)
            return UserPreferences(
                language=_doc.get("language") | "en",
                accepted_tc=_doc.get("accepted_tc") | None,
                sessions=_doc.get("sessions") | []
            )

    async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
        """
        Insert a new user preference
        :param user_id: str - The user_id to insert
        :param user_preference: UserPreferences - The user preferences to insert
        :return: UserPreferences
            The inserted user preferences
        """
        payload = user_preference.dict()
        payload["user_id"] = user_id

        _doc = await self.collection.insert_one(payload)
        return await self.get_user_preference_by_user_id(user_id=user_id)

    async def update_user_preference(self, user_id: str, update: UserPreferencesUpdateRequest) -> UserPreferences:
        """
        Update the user preferences by user_id
        :param user_id: str - The user_id to update
        :param update: UserPreferencesUpdateRequest - The update request
        :return: UserPreferences
            The updated user preferences
        :raises ValueError: if the user is not found - update failed
        """
        payload = update.dict(exclude_none=True)
        _doc = await self.collection.update_one({"user_id": {"$eq": user_id}}, {"$set": payload})

        return await self.get_user_preference_by_user_id(user_id=user_id)
