import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from features.skills_ranking.state.repositories.errors import RegistrationDataNotFoundError
from features.skills_ranking.state.repositories.types import IRegistrationDataRepository


class RegistrationMongoRepository(IRegistrationDataRepository):
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self._db = db
        self._logger = logging.getLogger(self.__class__.__name__)
        self._collection = db.get_collection(collection_name)


    async def get_prior_belief(self, user_id: str) -> float:
        try:
            doc = await self._collection.find_one(
                {"user_id": {"$eq": user_id}},
                {'priorBelief': 1, '_id': False}
            )

            if not doc or "priorBelief" not in doc:
                raise RegistrationDataNotFoundError(user_id)

            return doc["priorBelief"]
        except Exception as e:
            self._logger.error(f"Failed to get prior belief for user {user_id}: {e}")
            raise
