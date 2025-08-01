import logging
from abc import ABC

from .config import RankingServiceConfig
from .opportunities_data_service import IOpportunitiesDataService
from .types import JobSeeker
from features.skills_ranking.types import SkillsRankingScore
from common_libs.time_utilities import get_now
from features.skills_ranking.ranking_service.repositories.types import IJobSeekersRepository
from features.skills_ranking.ranking_service.utils.opportunity_ranking import get_opportunity_ranking
from features.skills_ranking.ranking_service.utils.other_job_seekers_ranking import other_job_seekers_ranking


class IRankingService(ABC):
    async def get_participant_ranking(self,
                                      *,
                                      user_id: str,
                                      prior_belief: float,
                                      participants_skills_uuids: set[str]) -> SkillsRankingScore:
        """
        Computes participant's ranking score based on their skills and prior belief and the opportunities dataset.

        :param user_id: The unique identifier for the user.
        :param prior_belief: The belief the user has about their skills ranks before the compass experiment.
        :param participants_skills_uuids: The set of unique skill identifiers associated with the participant.
        :return:
        """
        raise NotImplementedError


class RankingService(IRankingService):

    def __init__(self,
                 job_seekers_repository: IJobSeekersRepository,
                 opportunities_data_service: IOpportunitiesDataService,
                 config: RankingServiceConfig):

        self._job_seekers_repository = job_seekers_repository
        self._opportunities_data_service = opportunities_data_service
        self._logger = logging.getLogger(RankingService.__name__)
        self._config = config

    # ----------- MAIN Entry point function -----------
    async def get_participant_ranking(self,
                                      *,
                                      user_id: str,
                                      prior_belief: float,
                                      participants_skills_uuids: set[str]) -> SkillsRankingScore:

        # 1. Read the configurations for the experiment.
        #    — `opportunity_matching_threshold` (opportunity Matching Threshold)
        #    — `high_difference_threshold` (The high-difference threshold)
        opportunity_matching_threshold = self._config.matching_threshold
        job_seekers_batch_size = self._config.fetch_job_seekers_batch_size

        # 2. Read opportunities dataset
        opportunities_skills_uuids = await self._opportunities_data_service.get_opportunities_skills_uuids()

        # 3. Get the participant skills opportunity ranking by using (`opportunities_skills_uuids`, `participant_skills_uuids`, `opportunity_matching_threshold`)
        opportunities_rank = get_opportunity_ranking(opportunities_skills_uuids=opportunities_skills_uuids,
                                                     participant_skills_uuids=participants_skills_uuids,
                                                     opportunity_matching_threshold=opportunity_matching_threshold)

        # 4. Save the participant's rank in the opportunity seekers ranks dataset
        job_seeker = JobSeeker(
            user_id=user_id,
            skills_uuids=participants_skills_uuids,
            opportunity_rank=opportunities_rank,
            prior_belief=prior_belief
        )

        # 5. Read the `opportunities-seekers ranks dataset`.
        job_seekers_ranks = await self._job_seekers_repository.get_job_seekers_ranks(job_seekers_batch_size)

        # 5.1. Add the participant's rank to the jobseeker ranks database after getting the current version.
        await self._job_seekers_repository.save_job_seeker_rank(job_seeker)

        # 6. Get the opportunity seekers ranking by using (`opportunities seekers ranks dataset`, participants rank from the previous step),
        other_job_seekers_ranks = other_job_seekers_ranking(job_seekers_ranks=job_seekers_ranks,
                                                            participant_rank=opportunities_rank)

        score = SkillsRankingScore(
            jobs_matching_rank=opportunities_rank,
            comparison_rank=other_job_seekers_ranks,
            comparison_label=self._get_comparison_label(other_job_seekers_ranks),
            calculated_at=get_now(),
        )

        # 9. Return the score
        return score

    def _get_comparison_label(self, rank: float):
        """
        Get the comparison label based on the rank.

        :param rank:
        :return:
        """

        if rank < 20:
            comparison_label = "LOWEST"
        elif rank < 40:
            comparison_label = "SECOND_LOWEST"
        elif rank < 60:
            comparison_label = "MIDDLE"
        elif rank < 80:
            comparison_label = "SECOND_HIGHEST"
        else:
            comparison_label = "HIGHEST"

        self._logger.debug(f"Participant rank comparison label: {comparison_label} for rank: {rank}")

        return comparison_label
