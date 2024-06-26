from app.server_dependencies import get_mongo_db
from common_libs.environment_settings.constants import Collections


class UserPreferenceRepository:
    def __init__(self):
        self.collection = get_mongo_db().get_collection(Collections.USER_PREFERENCES)

    async def get_user_preference_by_user_id(self, user_id):
        return await self.collection.find_one({"user_id": user_id})

    async def insert_user_preference(self, user_preference):
        return await self.collection.insert_one(user_preference)

    async def update_user_preference(self, _filter, update):
        return await self.collection.update_one(_filter, {"$set": update})
