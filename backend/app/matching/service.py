"""Abstract base for matching-service implementations.

Concrete implementations (`MatchingServiceV1`, `MatchingServiceV2`) live in
`service_v1.py` / `service_v2.py`. Callers should obtain a service via
`get_matching_service()` in `get_service.py` and code against this ABC.
"""

from abc import ABC, abstractmethod
from typing import Optional

from app.matching.matching_types import (
    CompassMatchingResult,
    MatchingAlgorithmVersion,
    PreferenceVector,
    SkillsVector,
)


class MatchingService(ABC):
    @property
    @abstractmethod
    def algorithm_version(self) -> MatchingAlgorithmVersion:
        """Identifies which underlying matching algorithm this service uses."""

    @abstractmethod
    async def generate_recommendations(
        self,
        youth_id: str,
        city: Optional[str],
        province: Optional[str],
        skills_vector: SkillsVector,
        preference_vector: PreferenceVector,
    ) -> CompassMatchingResult:
        """Fetch matches for one user and return them in unified Compass form."""
