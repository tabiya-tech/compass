import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from common_libs.time_utilities import get_now
from .types import IJobSeekersRepository
from features.skills_ranking.ranking_service.types import JobSeeker


def _to_db_document(job_seeker: JobSeeker) -> dict:
    """
    Convert Job Seeker to a MongoDB document.

    For the database schema, refer to the JobSeeker model in the backend import script:
    @ref: https://github.com/tabiya-tech/zaf-rct/blob/main/backend/src/scripts/jobseeker-import/jobseekerModel.ts#L6
    """

    return {
        "externalUserId": job_seeker.external_user_id,
        "compassUserId": job_seeker.user_id,
        "taxonomyModelId": job_seeker.taxonomy_model_id,
        "skillsUUIDs": list(job_seeker.skills_uuids),
        "skillGroupsUUIDs": list(job_seeker.skill_groups_uuids),
        "opportunityRankPriorBelief": job_seeker.opportunity_rank_prior_belief,
        "opportunityRank": job_seeker.opportunity_rank,
        "compareToOthersPriorBelief": job_seeker.compare_to_others_prior_belief,
        "comparedToOthersRank": job_seeker.compared_to_others_rank,
        "opportunityDatasetVersion": job_seeker.opportunity_dataset_version,
        "numberOfTotalOpportunities": job_seeker.number_of_total_opportunities,
        "totalMatchingOpportunities": job_seeker.total_matching_opportunities,
        "matchingThreshold": job_seeker.matching_threshold,
        "opportunitiesLastFetchTime": job_seeker.opportunities_last_fetch_time,
        "updatedAt": get_now()
    }


def _from_db_document(document: dict) -> JobSeeker:
    """
    Convert a MongoDB document to a Job Seeker object.
    """

    return JobSeeker(
        user_id=document.get("compassUserId"),
        external_user_id=document.get("externalUserId"),
        skills_uuids=set(document.get("skillsUUIDs", [])),
        skill_groups_uuids=set(document.get("skillGroupsUUIDs", [])),
        taxonomy_model_id=document.get("taxonomyModelId"),
        opportunity_rank_prior_belief=document.get("opportunityRankPriorBelief"),
        opportunity_rank=document.get("opportunityRank"),
        compare_to_others_prior_belief=document.get("compareToOthersPriorBelief"),
        compared_to_others_rank=document.get("comparedToOthersRank"),
        opportunity_dataset_version=document.get("opportunityDatasetVersion"),
        
        number_of_total_opportunities=document.get("numberOfTotalOpportunities"),
        total_matching_opportunities=document.get("totalMatchingOpportunities"),
        matching_threshold=document.get("matchingThreshold"),
        opportunities_last_fetch_time=document.get("opportunitiesLastFetchTime"),
    )

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
                    ranks.extend(self._get_ranks_from_docs(docs))

                    # Reset the doc list for the next batch
                    docs = []

            # process the remaining docs.
            ranks.extend(self._get_ranks_from_docs(docs))

            if len(ranks) == 0:
                self._logger.error("No job seeker ranks found in the database.")

            return ranks
        except Exception as e:
            self._logger.error(f"Failed to get job seeker ranks: {e}")
            raise

    def _get_ranks_from_docs(self, job_seeker_docs: list[dict]):
        """
        Extract ranks (floats) from job seeker documents (MongoDB Documents).
        """

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
            # check if the jobseeker already exists in the database to prevent data collision
            existing_document = await self._collection.find_one(
                {"compassUserId": {"$eq": job_seeker.user_id}},
                {'_id': False}
            )

            # if the jobseeker already exists, log an error message
            document = _to_db_document(job_seeker)

            if existing_document:
                self._logger.error(
                    f"Job seeker {job_seeker.user_id} already exists in the database. Updating their rank.")
            else:
                document["createdAt"] = get_now()

            await self._collection.update_one(
                {"compassUserId": {"$eq": job_seeker.user_id}},
                {"$set": document},
                upsert=True
            )
        except Exception as e:
            self._logger.error(f"Failed to save job seeker rank for {job_seeker.user_id}: {e}")
            raise
