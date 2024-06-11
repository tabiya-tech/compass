from app.server_dependencies import get_mongo_db
from constants.database import Collections

class UserPreferenceRepository:
    collection = get_mongo_db().get_collection(Collections.USER_PREFERENCES)

    def get_user_preference_by_user_id(self, user_id):
        return self.collection.find_one({"user_id": user_id})

    def insert_user_preference(self, user_preference):
        return self.collection.insert_one(user_preference)

    def update_user_preference(self, _filter, update):
        return self.collection.update_one(_filter, update)
