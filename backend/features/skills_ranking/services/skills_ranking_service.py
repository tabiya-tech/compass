import logging
from abc import ABC, abstractmethod
from typing import Set
from datetime import datetime

import httpx
from pydantic import BaseModel

from features.skills_ranking.types import SkillsRankingScore, PriorBeliefs
from features.skills_ranking.services.errors import (
    SkillsRankingServiceHTTPError,
    SkillsRankingServiceTimeoutError,
    SkillsRankingServiceRequestError,
    SkillsRankingServiceError,
)

logger = logging.getLogger(__name__)

DEFAULT_HTTP_TIMEOUT_SECONDS = 30.0

class SkillsRankingRequest(BaseModel):
    """Request model for skills ranking calculation."""
    user_id: str
    prior_beliefs: PriorBeliefs
    participants_skills_uuids: Set[str]
    taxonomy_model_id: str


class SkillsRankingResponse(BaseModel):
    """Response model for skills ranking calculation."""
    jobs_matching_rank: float
    comparison_rank: float
    comparison_label: str
    calculated_at: datetime


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
        Call the external skills-ranking-service to calculate participant ranking.
        :param user_id : The user ID of the participant.
        :param prior_beliefs: The prior beliefs of the participant.
        :param participants_skills_uuids: The set of skill UUIDs for the participant
        :param taxonomy_model_id: The taxonomy model ID to use for ranking.
        :return: SkillsRankingScore containing the ranking results.
        """
        request_data = SkillsRankingRequest(
            user_id=user_id,
            prior_beliefs=prior_beliefs,
            participants_skills_uuids=participants_skills_uuids,
            taxonomy_model_id=taxonomy_model_id
        )
        
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key
        }
        
        url = f"{self.base_url}/api/v1/ranking/calculate"
        
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
                    jobs_matching_rank=response_data.jobs_matching_rank,
                    comparison_rank=response_data.comparison_rank,
                    comparison_label=response_data.comparison_label,
                    calculated_at=response_data.calculated_at
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
