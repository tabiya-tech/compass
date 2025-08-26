import logging
from abc import ABC

from .config import RankingServiceConfig
from .opportunities_data_service import IOpportunitiesDataService
from features.skills_ranking.ranking_service.types import JobSeeker
from features.skills_ranking.types import SkillsRankingScore, PriorBeliefs
from common_libs.time_utilities import get_now
from features.skills_ranking.ranking_service.repositories.types import IJobSeekersRepository, ITaxonomyRepository
from features.skills_ranking.ranking_service.utils.opportunity_ranking import get_opportunity_ranking
from features.skills_ranking.ranking_service.utils.other_job_seekers_ranking import other_job_seekers_ranking


class IRankingService(ABC):
    async def get_participant_ranking(self,
                                      *,
                                      user_id: str,
                                      prior_beliefs: PriorBeliefs,
                                      participants_skills_uuids: set[str]) -> SkillsRankingScore:
        """
        Computes participant's ranking score based on their skills and prior belief and the opportunity dataset.

        :param user_id: The unique identifier for the user.
        :param prior_beliefs: The prior beliefs of the jobseeker's rank about available opportunities and compared to other jobseekers.
        :param participants_skills_uuids: The set of unique skill identifiers associated with the participant.
        :return:
        """
        raise NotImplementedError


class RankingService(IRankingService):

    def __init__(self,
                 job_seekers_repository: IJobSeekersRepository,
                 taxonomy_repository: ITaxonomyRepository,
                 opportunities_data_service: IOpportunitiesDataService,
                 config: RankingServiceConfig,
                 *,
                 taxonomy_model_id: str):

        self._job_seekers_repository = job_seekers_repository
        self._taxonomy_repository = taxonomy_repository
        self._opportunities_data_service = opportunities_data_service
        self._logger = logging.getLogger(RankingService.__name__)
        self._config = config
        self._taxonomy_model_id = taxonomy_model_id

    # ----------- MAIN Entry point function -----------
    async def get_participant_ranking(self,
                                      *,
                                      user_id: str,
                                      prior_beliefs: PriorBeliefs,
                                      participants_skills_uuids: set[str]) -> SkillsRankingScore:

        # 1. Read the configurations for the experiment.
        #    — `opportunity_matching_threshold` (opportunity Matching Threshold)
        #    — `high_difference_threshold` (The high-difference threshold)
        opportunity_matching_threshold = self._config.matching_threshold
        job_seekers_batch_size = self._config.fetch_job_seekers_batch_size

        # 2. Read opportunities dataset
        opportunities_skills_uuids = await self._opportunities_data_service.get_opportunities_skills_uuids()

        # 3. Get the participant skills opportunity ranking by using (`opportunities_skills_uuids`, `participant_skills_uuids`, `opportunity_matching_threshold`)
        #    Note: We are using participant skill groups uuids instead of skill ids
        participant_skill_groups_uuids = await self._taxonomy_repository.get_skill_groups_from_skills(participants_skills_uuids)
        opportunities_rank, number_of_total_opportunities, total_matching_opportunities = \
            get_opportunity_ranking(
                opportunities_skills_uuids=opportunities_skills_uuids,
                participant_skills_uuids=participant_skill_groups_uuids,
                opportunity_matching_threshold=opportunity_matching_threshold
            )

        # 4. Read the `opportunities-seekers ranks dataset`.
        job_seekers_ranks = await self._job_seekers_repository.get_job_seekers_ranks(job_seekers_batch_size)

        # 5. Get the opportunity seekers ranking by using (`opportunities seekers ranks dataset`, participants rank from the previous step),
        other_job_seekers_ranks = other_job_seekers_ranking(job_seekers_ranks=job_seekers_ranks,
                                                            participant_rank=opportunities_rank)

        # 6. Save the participant's rank in the opportunity seekers ranks dataset
        job_seeker = JobSeeker(
            user_id=user_id,
            skills_uuids=participants_skills_uuids,
            skill_groups_uuids=participant_skill_groups_uuids,
            external_user_id=prior_beliefs.external_user_id,
            opportunity_rank=opportunities_rank,
            compared_to_others_rank=other_job_seekers_ranks,
            compare_to_others_prior_belief=prior_beliefs.compare_to_others_prior_belief,
            opportunity_rank_prior_belief=prior_beliefs.opportunity_rank_prior_belief,
            opportunity_dataset_version=self._opportunities_data_service.dataset_version,
            taxonomy_model_id=self._taxonomy_model_id,
            number_of_total_opportunities=number_of_total_opportunities,
            total_matching_opportunities=total_matching_opportunities,
            matching_threshold=opportunity_matching_threshold,
            opportunities_last_fetch_time=self._opportunities_data_service.last_fetch_time
        )

        # 7. Add the participant's rank to the jobseeker ranks database after getting the current version.
        await self._job_seekers_repository.save_job_seeker_rank(job_seeker)

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
        It should be the same as the one used in the frontend.
        ref: frontend-new/src/features/skillsRanking/components/skillsRankingDisclosure/types.ts#jobSeekerComparisonLabels

        :param rank: The rank of the participant, which should be between 0.0 and 1.0.
        :return: A string representing the comparison label based on the rank.
        """

        # GUARD: ensure that the rank is between 0.0 and 1.0
        if rank > 1.0 or rank < 0.0:
            raise ValueError(f"Rank must be between 0.0 and 1.0, got {rank}")

        if rank < 0.2:
            return "LOWEST"
        elif rank < 0.4:
            return "SECOND LOWEST"
        elif rank < 0.6:
            return "MIDDLE"
        elif rank < 0.8:
            return "SECOND HIGHEST"
        else:
            return "HIGHEST"
