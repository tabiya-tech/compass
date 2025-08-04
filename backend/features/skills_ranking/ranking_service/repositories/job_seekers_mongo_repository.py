import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from common_libs.time_utilities import get_now
from .types import IJobSeekersRepository
from ..services.types import JobSeeker


def _to_db_document(job_seeker: JobSeeker) -> dict:
    return {
        "user_id": job_seeker.user_id,
        "skills_uuids": list(job_seeker.skills_uuids),
        "opportunityRank": job_seeker.opportunity_rank
    }


class JobSeekersMongoRepository(IJobSeekersRepository):
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self._db = db
        self._logger = logging.getLogger(self.__class__.__name__)
        self._collection = db.get_collection(collection_name)

    async def get_job_seekers_ranks(self, batch_size: int) -> list[float]:
        try:
            cursor = self._collection.find({}, {'opportunityRank': 1, '_id': False}).batch_size(batch_size)

            ranks = []
            docs = []
            async for doc in cursor:
                docs.append(doc)

                if len(docs) >= batch_size:
                    # Process the batch
                    ranks.extend(self._validate_job_seeker(docs))

                    # Reset the doc list for the next batch
                    docs = []

            # process the remaining docs.
            ranks.extend(self._validate_job_seeker(docs))
            return ranks
        except Exception as e:
            self._logger.error(f"Failed to get job seeker ranks: {e}")
            raise

    def _validate_job_seeker(self, job_seeker_docs: list[dict]):
        ranks = []
        for job_seeker_doc in job_seeker_docs:
            rank = job_seeker_doc.get("opportunityRank")
            if rank is not None or isinstance(rank, float):
                ranks.append(rank)
            else:
                self._logger.error(f"Found job seeker with missing or invalid rank: {job_seeker_doc}")

        return ranks


    async def save_job_seeker_rank(self, job_seeker: JobSeeker) -> None:
        try:
            existing_document = await self._collection.find_one(
                {"user_id": {"$eq": job_seeker.user_id}},
                {'_id': False}
            )

            if existing_document:
                self._logger.error(
                    f"Job seeker {job_seeker.user_id} already exists in the database. Updating their rank.")

            document = _to_db_document(job_seeker)
            document["created_at"] = get_now()

            result = await self._collection.update_one(
                {"user_id": {"$eq": job_seeker.user_id}},
                {"$set": document},
                upsert=True
            )

            if result.modified_count == 0 and result.upserted_id is None:
                self._logger.warning(f"No changes made for job seeker {job_seeker.user_id}")
        except Exception as e:
            self._logger.error(f"Failed to save job seeker rank for {job_seeker.user_id}: {e}")
            raise
