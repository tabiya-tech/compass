import datetime
import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from common_libs.time_utilities import get_now, mongo_date_to_datetime, datetime_to_mongo_date, \
    convert_python_datetime_to_mongo_datetime
from .types import IJobSeekersRepository
from features.skills_ranking.ranking_service.types import JobSeeker, OpportunitiesInfo, DatasetInfo


def _to_db_document(job_seeker: JobSeeker) -> dict:
    """
    Convert Job Seeker to a MongoDB document.

    For the database schema, refer to the JobSeeker model in the backend import script:
    @ref: https://github.com/tabiya-tech/zaf-rct/blob/main/backend/src/scripts/jobseeker-import/jobseekerModel.ts#L6
    """

    # Mongo db objects, keys must be strings,
    # so because in our jobseeker's histories, keys are dates.
    # We need to convert them to strings
    # because in the ISO format, we have dot, not allowed in MongoDB keys,
    # we will replace the dot with an underscore.
    convert_date_to_str = lambda dt: convert_python_datetime_to_mongo_datetime(dt).isoformat().replace(".", "_")

    opportunity_rank_history = {
        convert_date_to_str(k): v for k, v in job_seeker.opportunity_rank_history.items()
    }
    compared_to_others_rank_history = {
        convert_date_to_str(k): v for k, v in job_seeker.compared_to_others_rank_history.items()
    }

    return {
        "compassUserId": job_seeker.user_id,
        "externalUserId": job_seeker.external_user_id,
        "skillsOriginUUIDs": list(job_seeker.skills_origin_uuids),
        "skillGroupsOriginUUIDs": list(job_seeker.skill_groups_origin_uuids),

        "opportunityRankPriorBelief": job_seeker.opportunity_rank_prior_belief,
        "opportunityRank": job_seeker.opportunity_rank,

        "compareToOthersPriorBelief": job_seeker.compare_to_others_prior_belief,
        "comparedToOthersRank": job_seeker.compared_to_others_rank,

        "datasetInfo": {
            "taxonomyModelId": job_seeker.dataset_info.taxonomy_model_id,
            "entitiesUsed": job_seeker.dataset_info.entities_used,
            "matchingThreshold": job_seeker.dataset_info.matching_threshold,
            "inputOpportunities": {
                "totalCount": job_seeker.dataset_info.input_opportunities.total_count,
                "hash": job_seeker.dataset_info.input_opportunities.hash,
                "hashAlgo": job_seeker.dataset_info.input_opportunities.hash_algo,
            },
            "matchingOpportunities": {
                "totalCount": job_seeker.dataset_info.matching_opportunities.total_count,
                "hash": job_seeker.dataset_info.matching_opportunities.hash,
                "hashAlgo": job_seeker.dataset_info.matching_opportunities.hash_algo,
            },
            "fetchTime": datetime_to_mongo_date(job_seeker.dataset_info.fetch_time)
        },

        "opportunityRankHistory": opportunity_rank_history,
        "comparedToOthersRankHistory": compared_to_others_rank_history,

        "updatedAt": get_now()
    }


def _from_db_document(document: dict) -> JobSeeker:
    """
    Convert a MongoDB document to a Job Seeker object.
    """

    dataset_info_doc = document.get("datasetInfo", {})

    input_opportunities = OpportunitiesInfo(
        total_count=dataset_info_doc.get("inputOpportunities", {}).get("totalCount", 0),
        hash=dataset_info_doc.get("inputOpportunities", {}).get("hash", ""),
        hash_algo=dataset_info_doc.get("inputOpportunities", {}).get("hashAlgo"),
    )

    matching_opportunities = OpportunitiesInfo(
        total_count=dataset_info_doc.get("matchingOpportunities", {}).get("totalCount", 0),
        hash=dataset_info_doc.get("matchingOpportunities", {}).get("hash", ""),
        hash_algo=dataset_info_doc.get("inputOpportunities", {}).get("hashAlgo"),
    )

    dataset_info = DatasetInfo(
        taxonomy_model_id=dataset_info_doc.get("taxonomyModelId"),
        entities_used=dataset_info_doc.get("entitiesUsed"),
        matching_threshold=dataset_info_doc.get("matchingThreshold"),
        input_opportunities=input_opportunities,
        matching_opportunities=matching_opportunities,
        fetch_time=mongo_date_to_datetime(dataset_info_doc.get("fetchTime"))
    )
    # As part of deserialization, because of `.` in ISO format not allowed in MongoDB keys,
    # we replaced `.` with `_` when storing in MongoDB. We are reversing that here.
    convert_str_to_date = lambda dt: mongo_date_to_datetime(datetime.datetime.fromisoformat(dt.replace("_", ".")))

    # mongodb histories are not stored as datetime keys, but as string keys,
    # so we need to convert them back to datetime keys
    opportunity_rank_history = {
        convert_str_to_date(k): v for k, v in
        document.get("opportunityRankHistory", {}).items()
    }

    compared_to_others_rank_history = {
        convert_str_to_date(k): v for k, v in
        document.get("comparedToOthersRankHistory", {}).items()
    }

    return JobSeeker(
        user_id=document.get("compassUserId"),
        external_user_id=document.get("externalUserId"),
        skills_origin_uuids=set(document.get("skillsOriginUUIDs", [])),
        skill_groups_origin_uuids=set(document.get("skillGroupsOriginUUIDs", [])),

        opportunity_rank_prior_belief=document.get("opportunityRankPriorBelief"),
        opportunity_rank=document.get("opportunityRank"),

        compare_to_others_prior_belief=document.get("compareToOthersPriorBelief"),
        compared_to_others_rank=document.get("comparedToOthersRank"),

        dataset_info=dataset_info,

        opportunity_rank_history=opportunity_rank_history,
        compared_to_others_rank_history=compared_to_others_rank_history
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

                # if we are updating an existing document, we need to preserve the histories of the tanks.
                for history_key, history_value in document.get("opportunityRankHistory", {}).items():
                    document[f"opportunityRankHistory.{history_key}"] = history_value

                for history_key, history_value in document.get("comparedToOthersRankHistory", {}).items():
                    document[f"comparedToOthersRankHistory.{history_key}"] = history_value

                del document["opportunityRankHistory"]
                del document["comparedToOthersRankHistory"]
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
