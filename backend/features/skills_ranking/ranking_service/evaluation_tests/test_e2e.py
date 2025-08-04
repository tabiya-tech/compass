import pytest

from features.skills_ranking.ranking_service.evaluation_tests.test_repositories import TestOpportunitiesDataService, TestJobSeekersDataRepository
from features.skills_ranking.ranking_service.services.config import RankingServiceConfig
from features.skills_ranking.ranking_service.services.ranking_service import RankingService
from features.skills_ranking.ranking_service.services.types import JobSeeker

test_opportunities_data_service = TestOpportunitiesDataService()
test_job_seekers_data_repository = TestJobSeekersDataRepository()

@pytest.mark.asyncio
@pytest.mark.parametrize("job_seeker", test_job_seekers_data_repository.get_all_job_seekers())
async def test_e2e_ranking_service(job_seeker: JobSeeker):

    ranking_service = RankingService(
        test_job_seekers_data_repository,
        test_opportunities_data_service,
        RankingServiceConfig(
            matching_threshold=0.2,
            fetch_job_seekers_batch_size=10
        )
    )

    rank = await ranking_service.get_participant_ranking(
        user_id=job_seeker.user_id,
        participants_skills_uuids=job_seeker.skills_uuids,
        prior_belief=job_seeker.prior_belief
    )

    assert job_seeker.opportunity_rank == rank.jobs_matching_rank
    assert job_seeker.compared_to_others_rank == rank.comparison_rank
