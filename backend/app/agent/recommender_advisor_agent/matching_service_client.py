"""
Matching Service HTTP Client for Recommender/Advisor Agent.

Handles communication with the deployed matching service endpoint.
Transforms Compass data formats to matching service API format.
"""

import logging
from typing import Optional, Dict, Any, List
import httpx
from pydantic import BaseModel


logger = logging.getLogger(__name__)


class MatchingServiceError(Exception):
    """Raised when matching service request fails."""
    pass


class MatchingServiceClient:
    """
    HTTP client for the deployed matching service.

    The service provides occupation, opportunity, and skill gap recommendations
    based on user skills and preferences.

    Authentication: API key via x-api-key header
    """

    def __init__(self, base_url: str, api_key: str, timeout: float = 30.0):
        """
        Initialize the matching service client.

        Args:
            base_url: Base URL for matching service
            api_key: API key for authentication
            timeout: Request timeout in seconds (default: 30)
        """
        self.base_url = base_url
        self.api_key = api_key
        self.timeout = timeout

        logger.info(f"Initialized MatchingServiceClient with base_url={base_url}")

    def _transform_skills_vector(self, skills_vector: Optional[Dict[str, Any]]) -> Dict[str, List]:
        """
        Transform Compass skills vector to matching service format.

        Compass format (from SkillsExtractor):
        {
            "skills": [
                {
                    "skill_id": "...",
                    "uuid": "...",
                    "preferred_label": "...",
                    "skill_type": "...",
                    "proficiency": 0.85,
                    "frequency": 2,
                    ...
                }
            ],
            "total_experiences": 3,
            "extraction_metadata": {...}
        }

        Matching service format:
        {
            "top_skills": [...]
        }

        Args:
            skills_vector: Skills vector from SkillsExtractor or None

        Returns:
            Dictionary with "top_skills" key containing list of skills
        """
        if not skills_vector or "skills" not in skills_vector:
            return {"top_skills": []}

        # Extract skills list
        skills_list = skills_vector.get("skills", [])

        # Transform to matching service format
        # Keep the full skill data - matching service can use what it needs
        top_skills = []
        for skill in skills_list:
            top_skills.append({
                "skill_id": skill.get("skill_id"),
                "uuid": skill.get("uuid"),
                "originUUID": skill.get("origin_uuid"),  # Required by matching service (same as uuid for now)
                "preferredLabel": skill.get("preferred_label"),
                "skill_type": skill.get("skill_type"),
                "proficiency": skill.get("proficiency", 0.5),
                "score": skill.get("avg_score", 0.5)  # Use avg_score as score
            })

        return {"top_skills": top_skills}

    def _extract_skill_group_uuids(self, skills_vector: Optional[Dict[str, Any]]) -> List[str]:
        """
        Extract skill group UUIDs from skills vector.

        NOTE: This is not currently tracked in Compass skills extraction.
        For v1, we return an empty list. This can be populated later if needed.

        Args:
            skills_vector: Skills vector from SkillsExtractor

        Returns:
            List of skill group origin UUIDs (currently always empty)
        """
        # TODO: Extract skill groups if available in future
        # For now, matching service accepts empty array
        return []

    def _transform_preference_vector(self, preference_vector: Optional[Any]) -> Dict[str, float]:
        """
        Transform PreferenceVector to matching service format.

        PreferenceVector from Epic 2 already has the correct structure:
        {
            "earnings_per_month": 0.5,
            "task_content": 0.2,
            "physical_demand": 0.3,
            "work_flexibility": 0.4,
            "social_interaction": 0.1,
            "career_growth": 0.5,
            "social_meaning": 0.3
        }

        Args:
            preference_vector: PreferenceVector from Epic 2

        Returns:
            Dictionary with preference dimensions and weights
        """
        if preference_vector is None:
            # Return default neutral preferences
            return {
                "earnings_per_month": 0.5,
                "task_content": 0.5,
                "physical_demand": 0.5,
                "work_flexibility": 0.5,
                "social_interaction": 0.5,
                "career_growth": 0.5,
                "social_meaning": 0.5
            }

        # Convert PreferenceVector to dict if it's a Pydantic model
        if hasattr(preference_vector, 'model_dump'):
            pref_dict = preference_vector.model_dump()
        elif isinstance(preference_vector, dict):
            pref_dict = preference_vector
        else:
            logger.warning(f"Unknown preference_vector type: {type(preference_vector)}")
            return {
                "earnings_per_month": 0.5,
                "task_content": 0.5,
                "physical_demand": 0.5,
                "work_flexibility": 0.5,
                "social_interaction": 0.5,
                "career_growth": 0.5,
                "social_meaning": 0.5
            }

        # Extract only the preference dimensions expected by matching service
        return {
            "earnings_per_month": pref_dict.get("earnings_per_month", 0.5),
            "task_content": pref_dict.get("task_content", 0.5),
            "physical_demand": pref_dict.get("physical_demand", 0.5),
            "work_flexibility": pref_dict.get("work_flexibility", 0.5),
            "social_interaction": pref_dict.get("social_interaction", 0.5),
            "career_growth": pref_dict.get("career_growth", 0.5),
            "social_meaning": pref_dict.get("social_meaning", 0.5)
        }

    async def generate_recommendations(
        self,
        youth_id: str,
        city: Optional[str],
        province: Optional[str],
        skills_vector: Optional[Dict[str, Any]],
        preference_vector: Optional[Any]
    ) -> Dict[str, Any]:
        """
        Call matching service to generate recommendations.

        Args:
            youth_id: User/youth identifier
            city: User's city (e.g., "Johannesburg", "Nairobi")
            province: User's province/state (e.g., "Gauteng", "Nairobi County")
            skills_vector: Skills vector from SkillsExtractor
            preference_vector: PreferenceVector from Epic 2

        Returns:
            Raw response from matching service (array of user objects)

        Raises:
            MatchingServiceError: If request fails
        """
        # Transform inputs to matching service format
        transformed_skills = self._transform_skills_vector(skills_vector)
        skill_groups = self._extract_skill_group_uuids(skills_vector)
        transformed_prefs = self._transform_preference_vector(preference_vector)

        # Build request payload (array of user objects)
        payload = [{
            "user_id": youth_id,
            "city": city or "Unknown",  # Default if not provided
            "province": province or "Unknown",  # Default if not provided
            "skills_vector": transformed_skills,
            "skill_groups_origin_uuids": skill_groups,
            "preference_vector": transformed_prefs
        }]

        logger.info(
            f"Calling matching service for user {youth_id} "
            f"(city={city}, province={province}, "
            f"skills_count={len(transformed_skills.get('top_skills', []))}, "
            f"prefs_keys={list(transformed_prefs.keys())})"
        )
        logger.debug(f"Matching service payload: {payload}")

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.base_url,
                    headers={
                        "x-api-key": self.api_key,
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=self.timeout
                )

                # Check for HTTP errors
                response.raise_for_status()

                # Parse JSON response
                result = response.json()

                logger.info(
                    f"Matching service returned successfully for user {youth_id} "
                    f"(status={response.status_code})"
                )
                logger.debug(f"Matching service response: {result}")

                return result

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Matching service HTTP error for user {youth_id}: "
                f"status={e.response.status_code}, body={e.response.text}"
            )
            raise MatchingServiceError(
                f"Matching service returned HTTP {e.response.status_code}: {e.response.text}"
            ) from e

        except httpx.RequestError as e:
            logger.error(
                f"Matching service request error for user {youth_id}: {str(e)}"
            )
            raise MatchingServiceError(
                f"Failed to connect to matching service: {str(e)}"
            ) from e

        except Exception as e:
            logger.exception(
                f"Unexpected error calling matching service for user {youth_id}"
            )
            raise MatchingServiceError(
                f"Unexpected matching service error: {str(e)}"
            ) from e
