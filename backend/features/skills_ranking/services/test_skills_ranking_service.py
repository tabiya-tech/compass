import datetime
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from features.skills_ranking.services.skills_ranking_service import (
    SkillsRankingService,
)
from features.skills_ranking.services.errors import (
    SkillsRankingServiceHTTPError,
    SkillsRankingServiceTimeoutError,
    SkillsRankingServiceRequestError,
)
from features.skills_ranking.types import PriorBeliefs, SkillsRankingScore


@pytest.fixture
def given_test_client():
    """Fixture to create a SkillsRankingService instance for testing."""
    return SkillsRankingService(base_url="https://test-service.com", api_key="test-api-key")


@pytest.fixture
def given_test_prior_beliefs():
    """Fixture to create test prior beliefs."""
    return PriorBeliefs(
        external_user_id="test-external-user",
        opportunity_rank_prior_belief=0.5,
        compare_to_others_prior_belief=0.6,
    )


@pytest.fixture
def given_test_skills_uuids():
    """Fixture to create test skills UUIDs."""
    return {"skill-uuid-1", "skill-uuid-2"}


@pytest.fixture
def given_test_taxonomy_model_id():
    """Fixture to create test taxonomy model ID."""
    return "test-taxonomy-model-123"


@pytest.fixture
def given_test_ranking_score():
    """Fixture to create test ranking score response."""
    return SkillsRankingScore(
        jobs_matching_rank=0.8,
        comparison_rank=0.7,
        comparison_label="high",
        calculated_at=datetime.datetime.now(datetime.timezone.utc),
    )


class TestSkillsRankingService:
    """Test class for SkillsRankingService."""

    @pytest.mark.asyncio
    async def test_get_participant_ranking_success(
        self,
        given_test_client: SkillsRankingService,
        given_test_prior_beliefs: PriorBeliefs,
        given_test_skills_uuids: set[str],
        given_test_taxonomy_model_id: str,
        given_test_ranking_score: SkillsRankingScore,
    ):
        # GIVEN a successful response from the external service
        mock_request = httpx.Request("POST", f"{given_test_client.base_url}/api/v1/ranking/calculate")
        mock_response = httpx.Response(
            status_code=200,
            json=given_test_ranking_score.model_dump(mode="json"),
            request=mock_request,
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN calling get_participant_ranking
            result = await given_test_client.get_participant_ranking(
                user_id="test-user-123",
                prior_beliefs=given_test_prior_beliefs,
                participants_skills_uuids=given_test_skills_uuids,
                taxonomy_model_id=given_test_taxonomy_model_id,
            )

            # THEN the result matches the expected score
            assert result == given_test_ranking_score

            # AND the correct URL was called
            mock_client.post.assert_called_once()
            call_args, call_kwargs = mock_client.post.call_args
            assert call_args[0] == "https://test-service.com/api/v1/ranking/calculate"

            # AND the correct headers were sent
            assert call_kwargs["headers"]["x-api-key"] == "test-api-key"
            assert call_kwargs["headers"]["Content-Type"] == "application/json"

            # AND the correct request data was sent
            actual_request_data = call_kwargs["json"]
            assert actual_request_data["user_id"] == "test-user-123"
            assert actual_request_data["prior_beliefs"] == given_test_prior_beliefs.model_dump(mode="json")
            assert set(actual_request_data["participants_skills_uuids"]) == given_test_skills_uuids
            assert actual_request_data["taxonomy_model_id"] == given_test_taxonomy_model_id

    @pytest.mark.asyncio
    async def test_get_participant_ranking_http_error(
        self,
        given_test_client: SkillsRankingService,
        given_test_prior_beliefs: PriorBeliefs,
        given_test_skills_uuids: set[str],
        given_test_taxonomy_model_id: str,
    ):
        # GIVEN an HTTP error response from the external service
        mock_request = httpx.Request("POST", "https://test-service.com/api/v1/ranking/calculate")
        mock_response = httpx.Response(
            status_code=500,
            request=mock_request,
            text="Internal server error from upstream service",
        )
        http_error = httpx.HTTPStatusError("Server error", request=mock_request, response=mock_response)

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = http_error
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN calling get_participant_ranking
            # THEN a SkillsRankingClientHTTPError is raised
            with pytest.raises(SkillsRankingServiceHTTPError) as exc_info:
                await given_test_client.get_participant_ranking(
                    user_id="test-user-123",
                    prior_beliefs=given_test_prior_beliefs,
                    participants_skills_uuids=given_test_skills_uuids,
                    taxonomy_model_id=given_test_taxonomy_model_id,
                )

            # AND the error contains the correct status code and body
            assert exc_info.value.status_code == 500
            assert "Internal server error from upstream service" in exc_info.value.body

    @pytest.mark.asyncio
    async def test_get_participant_ranking_timeout_error(
        self,
        given_test_client: SkillsRankingService,
        given_test_prior_beliefs: PriorBeliefs,
        given_test_skills_uuids: set[str],
        given_test_taxonomy_model_id: str,
    ):
        # GIVEN a timeout error from the external service
        timeout_error = httpx.TimeoutException("Request timed out")

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = timeout_error
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN calling get_participant_ranking
            # THEN a SkillsRankingClientTimeoutError is raised
            with pytest.raises(SkillsRankingServiceTimeoutError) as exc_info:
                await given_test_client.get_participant_ranking(
                    user_id="test-user-123",
                    prior_beliefs=given_test_prior_beliefs,
                    participants_skills_uuids=given_test_skills_uuids,
                    taxonomy_model_id=given_test_taxonomy_model_id,
                )

            # AND the error message is informative
            assert "Timeout while calling skills-ranking-service" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_participant_ranking_request_error(
        self,
        given_test_client: SkillsRankingService,
        given_test_prior_beliefs: PriorBeliefs,
        given_test_skills_uuids: set[str],
        given_test_taxonomy_model_id: str,
    ):
        # GIVEN a request error from the external service
        request_error = httpx.RequestError("Network unreachable")

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = request_error
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN calling get_participant_ranking
            # THEN a SkillsRankingClientRequestError is raised
            with pytest.raises(SkillsRankingServiceRequestError) as exc_info:
                await given_test_client.get_participant_ranking(
                    user_id="test-user-123",
                    prior_beliefs=given_test_prior_beliefs,
                    participants_skills_uuids=given_test_skills_uuids,
                    taxonomy_model_id=given_test_taxonomy_model_id,
                )

            # AND the error message contains the network error details
            assert "Network unreachable" in str(exc_info.value)


