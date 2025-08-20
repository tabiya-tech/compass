import pytest

from app.app_config import ApplicationConfig
from common_libs.test_utilities import get_random_printable_string
from features.skills_ranking.ranking_service.repositories.types import IJobSeekersRepository
from features.skills_ranking.ranking_service.services.opportunities_data_service import IOpportunitiesDataService
from features.skills_ranking.ranking_service.services.ranking_service import RankingService
from features.skills_ranking.ranking_service.services.config import RankingServiceConfig
from features.skills_ranking.types import PriorBeliefs


class _FakeJobSeekersRepository(IJobSeekersRepository):
    def __init__(self):
        self.saved_job_seeker = None

    async def get_job_seekers_ranks(self, batch_size: int):  # noqa: ARG002 - part of the interface
        return [0.6, 0.3]

    async def save_job_seeker_rank(self, job_seeker):
        self.saved_job_seeker = job_seeker


class _FakeOpportunitiesDataService(IOpportunitiesDataService):
    def __init__(self, opportunities_sets):
        self._opportunities_sets = opportunities_sets

    async def get_opportunities_skills_uuids(self):
        return self._opportunities_sets

    async def get_opportunities(self):
        result = []
        for skills in self._opportunities_sets:
            result.append({
                "active": True,
                "occupation": get_random_printable_string(10),
                "opportunityText": get_random_printable_string(10),
                "opportunityTitle": get_random_printable_string(10),
                "opportunityUrl": get_random_printable_string(10),
                "postedAt": get_random_printable_string(10),
                "skills": skills,
                "skillGroups": []
            })
        return result


class TestGetComparisonLabel:
    @pytest.mark.parametrize(
        "participant_rank,comparison_label", [
            (0.0, "LOWEST"),  # Edge case for the lowest rank
            (0.05, "LOWEST"),
            (0.15, "LOWEST"),
            (0.2, "SECOND LOWEST"),  # Edge case for the second lowest threshold
            (0.23, "SECOND LOWEST"),
            (0.4, "MIDDLE"),  # Edge case for the middle threshold
            (0.5, "MIDDLE"),
            (0.6, "SECOND HIGHEST"),  # Edge case for the second highest threshold
            (0.7, "SECOND HIGHEST"),
            (0.8, "HIGHEST"),  # Edge case for the highest threshold
            (0.9, "HIGHEST"),
            (1.0, "HIGHEST"),  # Edge case for the highest rank
        ])
    def test_get_comparison_label(self, participant_rank, comparison_label):
        # GIVEN a participant rank
        given_participant_rank = participant_rank

        # WHEN the comparison label is computed
        ranking_service = RankingService(None, None, None)  # type: ignore not used in this test
        actual_comparison_label = ranking_service._get_comparison_label(given_participant_rank)

        # THEN the actual comparison label matches the expected value
        assert actual_comparison_label == comparison_label


    @pytest.mark.parametrize(
        "participant_rank", [
            -0.1,  # Below the minimum valid rank
            1.1,   # Above the maximum valid rank
            2.0,   # Significantly above the maximum valid rank
            -0.5,  # Negative rank
        ]
    )
    def test_get_comparison_label_invalid_rank(self, participant_rank):
        # GIVEN an invalid participant rank
        given_participant_rank = participant_rank

        # WHEN the comparison label is computed
        ranking_service = RankingService(None, None, None)  # type: ignore not used in this test

        # THEN it raises a ValueError
        with pytest.raises(ValueError):
            ranking_service._get_comparison_label(given_participant_rank)


@pytest.mark.asyncio
async def test_get_participant_ranking_saves_metadata_and_uses_dataset_version(mocker,
                                                                               setup_application_config: ApplicationConfig):
    # GIVEN a ranking service
    fake_repository = _FakeJobSeekersRepository()
    fake_opportunities = [
        {"a", "b"},   # overlap with participant: 1/2 = 0.5 (not strictly > 0.5)
        {"b"},         # overlap with participant: 1/1 = 1 (> 0.5) → counts
    ]
    fake_opportunities_service = _FakeOpportunitiesDataService(fake_opportunities)

    config = RankingServiceConfig(matching_threshold=0.5, fetch_job_seekers_batch_size=10)

    # AND the dataset version util is calculated
    fake_md5 = "md5-abc"
    def _fake_compute_version(opportunities):
        return fake_md5

    mocker.patch(
        "features.skills_ranking.ranking_service.services.ranking_service.compute_opportunities_dataset_version_from_docs",
        side_effect=_fake_compute_version,
    )

    # AND the ranking service is initialized
    service = RankingService(
        job_seekers_repository=fake_repository,
        opportunities_data_service=fake_opportunities_service,
        config=config,
    )

    # WHEN the participant ranking is computed
    participant_skills = {"b"}
    await service.get_participant_ranking(
        user_id="user-1",
        prior_beliefs=PriorBeliefs(
            compare_to_others_prior_belief=0.3,
            opportunity_rank_prior_belief=0.6,
        ),
        participants_skills_uuids=participant_skills,
    )

    # THEN the job seeker is saved with expected metadata
    saved = fake_repository.saved_job_seeker
    assert saved is not None
    assert saved.opportunity_dataset_version == fake_md5
    assert saved.number_of_total_opportunities == 2
    assert saved.total_matching_opportunities == 1  # only the second opportunity strictly exceeds 0.5
    assert saved.matching_threshold == 0.5
    assert saved.taxonomy_model_id == setup_application_config.taxonomy_model_id
    assert saved.embedding_version == f"{setup_application_config.embeddings_service_name}:{setup_application_config.embeddings_model_name}"
