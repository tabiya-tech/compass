import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from features.skills_ranking.ranking_service.repositories.types import IOpportunitiesDataRepository


class OpportunitiesDataRepository(IOpportunitiesDataRepository):
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self._db = db
        self._logger = logging.getLogger(OpportunitiesDataRepository.__name__)
        self._collection = db.get_collection(collection_name)

    # REVIEW: redundant default value for `batch_size` since it is already set in the config
    async def get_opportunities_skills_uuids(self, limit: int, batch_size: int = 250) -> list[set[str]]:
        try:
            # fetch the opportunities from the collection
            # REVIEW: use eq to avoid nosql injection
            cursor = self._collection.find({"active": {"$eq": True}}, {'skills.UUID': 1, '_id': False}).limit(limit).batch_size(
                batch_size)

            skills_sets = []
            opportunities_docs = []
            async for doc in cursor:
                opportunities_docs.append(doc)

                # Only convert the skills to the set after the batch size is reached.
                # And the cursor will fetch the next batch.
                if len(opportunities_docs) >= batch_size:
                    # process the batch
                    # REVIEW: rename `doc` to `opportunity_doc` since it sort of shadows the `doc` variable
                    skills_sets.extend({skill["UUID"] for skill in doc.get("skills", [])} for doc in opportunities_docs)
                    opportunities_docs = []

            return skills_sets
        except:
            # REVIEW: do we want to raise and log a specific exception here?
            # perhaps not, since the only thing that can go wrong is database related
            self._logger.error("Failed to get skills from opportunities")
            raise
