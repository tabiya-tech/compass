import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from features.skills_ranking.state.repositories.errors import RegistrationDataNotFoundError
from features.skills_ranking.state.repositories.types import IRegistrationDataRepository
from features.skills_ranking.types import PriorBeliefs


class RegistrationMongoRepository(IRegistrationDataRepository):
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self._db = db
        self._logger = logging.getLogger(self.__class__.__name__)
        self._collection = db.get_collection(collection_name)

    async def get_prior_beliefs(self, user_id: str) -> PriorBeliefs:
        try:
            # get the registration data for the user to pick the prior beliefs
            # For data structure see:-
            # https://github.com/tabiya-tech/zaf-rct/blob/main/backend/src/createUser/usersModel.ts#L10
            doc = await self._collection.find_one(
                {"compassUserId": {"$eq": user_id}},
                {'opportunityRankPriorBelief': 1, "compareToOthersPriorBelief": 1, '_id': False}
            )

            if not doc:
                raise RegistrationDataNotFoundError(user_id)

            if "opportunityRankPriorBelief" not in doc:
                raise RegistrationDataNotFoundError(user_id)

            if "compareToOthersPriorBelief" not in doc:
                self._logger.error("compareToOthersPriorBelief not found in document, setting to default 0.0")

            return PriorBeliefs(
                compare_to_others_prior_belief=doc.get("compareToOthersPriorBelief", 0.0),
                opportunity_rank_prior_belief=doc.get("opportunityRankPriorBelief") # it is validated to be available
            )
        except Exception as e:
            self._logger.error(f"Failed to get prior belief for user {user_id}: {e}")
            raise
