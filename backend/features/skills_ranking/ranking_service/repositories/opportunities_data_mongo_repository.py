import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from features.skills_ranking.ranking_service.repositories.types import IOpportunitiesDataRepository


class OpportunitiesDataRepository(IOpportunitiesDataRepository):
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self._db = db
        self._logger = logging.getLogger(OpportunitiesDataRepository.__name__)
        self._collection = db.get_collection(collection_name)

    async def get_opportunities_skills_uuids(self, limit: int, batch_size: int) -> list[set[str]]:
        try:
            # fetch the opportunities from the collection
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
                    skills_sets.extend({skill["UUID"] for skill in opportunity_doc.get("skills", [])} for opportunity_doc in opportunities_docs)
                    opportunities_docs = []

            return skills_sets
        except:
            self._logger.error("Failed to get skills from opportunities")
            raise
