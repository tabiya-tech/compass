"""
DB6 Youth Database Client Interface.

This module defines the interface contract for Epic 1's DB6 Youth Database.

**IMPORTANT**: This is an INTERFACE/CONTRACT only.
The actual implementation will be provided by the Epic 1 contractor.

Epic 2 (Preference Elicitation Agent) uses this interface to:
- Read youth profiles (to access prior experiences)
- Write preference vectors (after preference elicitation completes)

The implementation should:
- Store youth profiles in MongoDB (or agreed database)
- Provide async CRUD operations
- Handle errors gracefully
- Follow existing backend patterns for DB access
"""

from abc import ABC, abstractmethod
from typing import Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone

from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.preference_elicitation_agent.types import PreferenceVector


class YouthProfile(BaseModel):
    """
    Youth profile schema matching Epic 1 DB6 specification (deliverables PDF page 8).

    This model represents a complete youth profile containing:
    - Past experiences (from Epic 4 skills elicitation)
    - Skills vector (from Epic 4)
    - Preference vector (from Epic 2)
    - Qualifications (certificates, diplomas, degrees)
    - Interaction history (agent sessions, recommendations)
    """

    youth_id: str
    """Pseudonymous identifier (e.g. session_id or user_id)"""

    demographics: Optional[dict[str, Any]] = None
    """Demographics where appropriate (age, location, etc.)"""

    past_experiences: list[ExperienceEntity] = Field(default_factory=list)
    """
    Past experiences linked to occupations and tasks.
    Populated by Epic 4 skills elicitation agent.
    """

    skills_vector: Optional[dict[str, Any]] = None
    """
    Skills vector from Epic 4.
    Format TBD by Epic 1 contractor.
    """

    preference_vector: Optional[PreferenceVector] = None
    """
    Preference vector from Epic 2 preference elicitation agent.
    """

    qualifications: list[dict[str, Any]] = Field(default_factory=list)
    """
    Certificates, diplomas, degrees.
    Each item should have: type, name, institution, date, etc.
    """

    interaction_history: list[dict[str, Any]] = Field(default_factory=list)
    """
    Sessions with agents, recommendations shown, actions taken.
    Each item should have: agent, timestamp, action, metadata, etc.
    """

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    """Timestamp when profile was created"""

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    """Timestamp when profile was last updated"""

    class Config:
        extra = "forbid"


class DB6Client(ABC):
    """
    Abstract interface for Epic 1's DB6 Youth Database client.

    **IMPLEMENTATION**: Epic 1 contractor will provide the concrete implementation.
    **USAGE**: Epic 2, Epic 3, and Epic 4 agents will use this interface.

    Expected implementation location (by Epic 1 contractor):
    - compass/backend/app/epic1/db6_youth_database/db6_client_impl.py

    The implementation should:
    - Store profiles in MongoDB (or agreed database)
    - Use existing backend database connection patterns
    - Handle concurrent access safely
    - Log errors appropriately
    - Follow existing error handling patterns

    Example usage (Epic 2):
    ```python
    db6_client = get_db6_client()  # Factory provided by Epic 1

    # Read profile
    profile = await db6_client.get_youth_profile("youth_123")

    # Update preference vector
    profile.preference_vector = new_vector
    await db6_client.save_youth_profile(profile)
    ```
    """

    @abstractmethod
    async def save_youth_profile(self, profile: YouthProfile) -> None:
        """
        Save or update a youth profile.

        If a profile with the given youth_id exists, it should be updated.
        If not, a new profile should be created.

        Args:
            profile: Complete youth profile to save

        Raises:
            Exception: If database save fails (implementation-specific)
        """
        raise NotImplementedError("Epic 1 contractor must implement this method")

    @abstractmethod
    async def get_youth_profile(self, youth_id: str) -> Optional[YouthProfile]:
        """
        Retrieve a youth profile by ID.

        Args:
            youth_id: Pseudonymous youth identifier (typically session_id)

        Returns:
            YouthProfile if found, None if not found

        Raises:
            Exception: If database query fails (implementation-specific)
        """
        raise NotImplementedError("Epic 1 contractor must implement this method")

    @abstractmethod
    async def delete_youth_profile(self, youth_id: str) -> bool:
        """
        Delete a youth profile by ID.

        Args:
            youth_id: Pseudonymous youth identifier

        Returns:
            True if profile was deleted, False if not found

        Raises:
            Exception: If database delete fails (implementation-specific)
        """
        raise NotImplementedError("Epic 1 contractor must implement this method")


# Stub implementation for development/testing without Epic 1
class StubDB6Client(DB6Client):
    """
    Stub implementation for development and testing when Epic 1 DB6 is not available.

    This is a simple in-memory implementation that:
    - Stores profiles in a dictionary
    - Provides the same interface as the real DB6 client
    - Allows Epic 2/3/4 development to proceed without Epic 1 dependency

    **NOT FOR PRODUCTION USE** - This is replaced by Epic 1's implementation.
    """

    def __init__(self):
        self._profiles: dict[str, YouthProfile] = {}

    async def save_youth_profile(self, profile: YouthProfile) -> None:
        """Save profile to in-memory store."""
        profile.updated_at = datetime.now(timezone.utc)
        self._profiles[profile.youth_id] = profile

    async def get_youth_profile(self, youth_id: str) -> Optional[YouthProfile]:
        """Get profile from in-memory store."""
        return self._profiles.get(youth_id)

    async def delete_youth_profile(self, youth_id: str) -> bool:
        """Delete profile from in-memory store."""
        if youth_id in self._profiles:
            del self._profiles[youth_id]
            return True
        return False
