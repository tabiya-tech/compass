"""
Youth Database Integration for Preference Elicitation Agent.

Handles interactions with the youth profile database including:
- Fetching youth profiles and experiences
- Saving preference vectors
- Fallback to local snapshot when database unavailable
"""

import logging
from typing import Optional, TYPE_CHECKING
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.preference_elicitation_agent.types import PreferenceVector

if TYPE_CHECKING:
    try:
        from app.database_contracts.db6_youth_database.db6_client import DB6Client, YouthProfile
    except ImportError:
        DB6Client = None
        YouthProfile = None


class DB6IntegrationManager:
    """
    Manages interactions with the youth profile database.

    Provides graceful fallback to local snapshot data when database is unavailable.
    """

    def __init__(self, db6_client: Optional['DB6Client'] = None):
        """
        Initialize youth database integration manager.

        Args:
            db6_client: Optional youth database client
        """
        self.logger = logging.getLogger(self.__class__.__name__)
        self._db6_client = db6_client

    async def get_experiences_for_youth(
        self,
        youth_id: str,
        snapshot_fallback: Optional[list[ExperienceEntity]] = None
    ) -> Optional[list[ExperienceEntity]]:
        """
        Fetch experiences for a youth from database, with snapshot fallback.

        Args:
            youth_id: Youth identifier
            snapshot_fallback: Local snapshot to use if database unavailable

        Returns:
            List of ExperienceEntity objects or None
        """
        # Try database first if available
        if self._db6_client:
            try:
                profile = await self._db6_client.get_youth_profile(youth_id)
                if profile and profile.experiences:
                    self.logger.info(f"Fetched {len(profile.experiences)} experiences from database")
                    return profile.experiences
            except Exception as e:
                self.logger.warning(f"Database fetch failed, using snapshot: {e}")

        # Fallback to snapshot
        if snapshot_fallback:
            self.logger.debug(f"Using snapshot with {len(snapshot_fallback)} experiences")
            return snapshot_fallback

        return None

    async def save_preference_vector(
        self,
        youth_id: str,
        preference_vector: PreferenceVector
    ) -> bool:
        """
        Save preference vector to youth database.

        Args:
            youth_id: Youth identifier
            preference_vector: PreferenceVector to save

        Returns:
            True if saved successfully, False otherwise
        """
        if not self._db6_client:
            self.logger.debug("Youth database not configured, skipping save")
            return False

        try:
            # Check if profile exists
            profile = await self._db6_client.get_youth_profile(youth_id)

            if profile:
                # Update existing profile
                profile.preference_vector = preference_vector
                await self._db6_client.save_youth_profile(profile)
                self.logger.info(
                    f"Updated preference vector in database for youth {youth_id} "
                    f"(confidence: {preference_vector.confidence_score:.2f})"
                )
            else:
                # Create new profile
                from app.database_contracts.db6_youth_database.db6_client import YouthProfile

                new_profile = YouthProfile(
                    youth_id=youth_id,
                    preference_vector=preference_vector,
                    experiences=[]
                )
                await self._db6_client.save_youth_profile(new_profile)
                self.logger.info(f"Created new youth profile for {youth_id}")

            return True

        except Exception as e:
            self.logger.error(f"Failed to save preference vector to database: {e}")
            return False
