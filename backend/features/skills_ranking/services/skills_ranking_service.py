import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Set

import httpx
from pydantic import BaseModel, Field

from features.skills_ranking.services.errors import (
    SkillsRankingServiceHTTPError,
    SkillsRankingServiceTimeoutError,
    SkillsRankingServiceRequestError,
    SkillsRankingServiceError,
)
from features.skills_ranking.types import SkillsRankingScore, PriorBeliefs

logger = logging.getLogger(__name__)

DEFAULT_HTTP_TIMEOUT_SECONDS = 30.0


class SkillsRankingRequest(BaseModel):
    """Request model for skills ranking calculation."""
    user_id: str
    province: str
    participants_skills_uuids: Set[str]
    taxonomy_model_id: str


class SkillsRankingResponse(BaseModel):
    """Response model for skills ranking calculation."""
    above_average_labels: list[str] = Field(default_factory=list)
    below_average_labels: list[str] = Field(default_factory=list)
    most_demanded_label: str
    most_demanded_percent: float
    least_demanded_label: str
    least_demanded_percent: float
    average_percent_for_jobseeker_skill_groups: float
    average_count_for_jobseeker_skill_groups: float
    province_used: str
    matched_skill_groups: int


class ISkillsRankingService(ABC):
    @abstractmethod
    async def get_participant_ranking(
            self,
            user_id: str,
            prior_beliefs: PriorBeliefs,
            participants_skills_uuids: Set[str],
            taxonomy_model_id: str,
    ) -> SkillsRankingScore:
        """Calculate participant ranking via the external service."""
        raise NotImplementedError


class SkillsRankingService(ISkillsRankingService):
    """HTTP client for calling the external skills-ranking-service."""

    def __init__(self, base_url: str, api_key: str, timeout_seconds: float = DEFAULT_HTTP_TIMEOUT_SECONDS):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self._logger = logging.getLogger(self.__class__.__name__)

    async def get_participant_ranking(
            self,
            user_id: str,
            prior_beliefs: PriorBeliefs,
            participants_skills_uuids: Set[str],
            taxonomy_model_id: str,
    ) -> SkillsRankingScore:
        """
        Call the external skills-ranking-service to fetch demand insights for a participant's skills.
        :param user_id : The user ID of the participant.
        :param prior_beliefs: The prior beliefs of the participant.
        :param participants_skills_uuids: The set of skill UUIDs for the participant.
        :param taxonomy_model_id: The taxonomy model ID to use for ranking.
        :return: SkillsRankingScore containing demand-oriented labels and percentages.
        """
        request_data = SkillsRankingRequest(
            user_id=user_id,
            province=prior_beliefs.province,  # The province used comes from the prior beliefs.
            # We should be collecting this data during boarding of a jobseeker.
            participants_skills_uuids=participants_skills_uuids,
            taxonomy_model_id=taxonomy_model_id
        )

        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key
        }

        url = f"{self.base_url}/api/v2/ranking/calculate"

        self._logger.info(f"Calling skills-ranking-service: {url}")

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            try:
                response = await client.post(
                    url,
                    json=request_data.model_dump(mode="json"),
                    headers=headers
                )
                response.raise_for_status()

                response_data = SkillsRankingResponse(**response.json())

                # Convert the response to SkillsRankingScore
                score = SkillsRankingScore(
                    calculated_at=datetime.now(timezone.utc),
                    # Marking the calculated at as the time after results have arrived.
                    above_average_labels=response_data.above_average_labels,
                    below_average_labels=response_data.below_average_labels,
                    most_demanded_label=response_data.most_demanded_label,
                    most_demanded_percent=response_data.most_demanded_percent,
                    least_demanded_label=response_data.least_demanded_label,
                    least_demanded_percent=response_data.least_demanded_percent,
                    average_percent_for_jobseeker_skill_groups=response_data.average_percent_for_jobseeker_skill_groups,
                    average_count_for_jobseeker_skill_groups=response_data.average_count_for_jobseeker_skill_groups,
                    province_used=response_data.province_used,
                    matched_skill_groups=response_data.matched_skill_groups
                )

                self._logger.info(f"Successfully calculated ranking for user {user_id}")
                return score

            except httpx.HTTPStatusError as e:
                raise SkillsRankingServiceHTTPError(e.response.status_code, e.response.text)
            except httpx.TimeoutException as e:
                raise SkillsRankingServiceTimeoutError(str(e))
            except httpx.RequestError as e:
                raise SkillsRankingServiceRequestError(str(e))
            except Exception as e:
                raise SkillsRankingServiceError(str(e))
