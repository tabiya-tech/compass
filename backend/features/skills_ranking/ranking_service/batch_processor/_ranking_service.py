"""
Batch Processor – Ranking Service Version

This module was separated from the main ranking service because its implementation needs to differ from the API-facing ranking service.

Key Differences

1. No persistence:
    This Ranking service does not need to save jobseekers after calculating their rank.
    The caller will be the one responsible to do so if we are in hot run mode.

2. No Taxonomy reference needed:
    This Ranking service does not need to reference the taxonomy repository to convert skills to skill groups,
    as it does not need to validate skill UUIDs. The jobseeker object already has the skill groups.
    Otherwise, we would have to first check different taxonomy ids for each jobseeker, which would be inefficient.

3. No "compared-to-others" rank:
    Recomputing this value over time adds little practical value.
    Implementing it would require calculating all jobseekers’ ranks, persisting them to the database,
    and then computing the "compared-to-others" rank on top — which would introduce unnecessary complexity.

4. No "compared-to-others" label:
    The jobseeker schema does not require this field, so it is omitted.

Design Choice

    Instead of modifying the existing ranking service (used by the API), a dedicated batch processor ranking service was created.
    It reuses utility functions from the main ranking service while simplifying logic specific to batch processing.
"""

from common_libs.time_utilities import get_now
from features.skills_ranking.ranking_service.types import JobSeeker, DatasetInfo, OpportunitiesInfo
from features.skills_ranking.ranking_service.utils.opportunity_ranking import get_opportunity_ranking
from features.skills_ranking.ranking_service.services.opportunities_data_service import IOpportunitiesDataService


class RankingService:
    def __init__(self, *,
                 opportunities_data_service: IOpportunitiesDataService,
                 matching_threshold: float):
        """
        :param opportunities_data_service: The opportunity data service to fetch opportunity data.
        :param matching_threshold: The threshold for matching opportunities. (the percentage of skills that need to match)
        """
        self._opportunities_data_service = opportunities_data_service
        self._matching_threshold = matching_threshold

    async def re_rank_job_seeker(self, job_seeker: JobSeeker) -> JobSeeker:
        """
        Re-rank a jobseeker based on the latest opportunity dataset.
        This method fetches the latest opportunities, computes the new ranking for the jobseeker,
        and updates the jobseeker's ranking history and dataset information.

        :param job_seeker: The jobseeker to re-rank.
        :return: JobSeeker with updated ranking and dataset info.
        """

        # 0. Have a copy of the jobseeker to avoid mutating the input directly and unexpected side effects.
        new_job_seeker = job_seeker.model_copy()

        # 1. Read the configurations for the experiment.
        #    — `opportunity_matching_threshold` (opportunity Matching Threshold)
        opportunity_matching_threshold = self._matching_threshold

        # 2. Read opportunities dataset
        opportunities_skills_uuids = await self._opportunities_data_service.get_opportunities_skills_uuids()

        (opportunities_rank,
         number_of_total_opportunities,
         total_matching_opportunities, matching_opportunities_hash) = get_opportunity_ranking(
            opportunities_skills_uuids=opportunities_skills_uuids,
            participant_skills_uuids=new_job_seeker.skill_groups_origin_uuids,
            opportunity_matching_threshold=opportunity_matching_threshold)

        # Update the jobseeker object with the new ranking and dataset info
        new_job_seeker.opportunity_rank = opportunities_rank
        new_job_seeker.dataset_info = DatasetInfo(
            taxonomy_model_id=new_job_seeker.dataset_info.taxonomy_model_id,
            matching_threshold=opportunity_matching_threshold,
            entities_used="skillGroups",
            fetch_time=self._opportunities_data_service.last_fetch_time,
            input_opportunities=OpportunitiesInfo(
                total_count=number_of_total_opportunities,
                hash=self._opportunities_data_service.dataset_version,
                hash_algo="md5"
            ),
            matching_opportunities=OpportunitiesInfo(
                total_count=total_matching_opportunities,
                hash=matching_opportunities_hash,
                hash_algo="md5"
            )
        )

        calculated_at = get_now()
        new_job_seeker.opportunity_rank_history = {
            **new_job_seeker.opportunity_rank_history,
            calculated_at: opportunities_rank
        }

        return new_job_seeker
