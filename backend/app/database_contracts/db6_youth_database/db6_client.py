"""
DB6 Youth Database Client Interface.

This module defines the interface contract for the youth profile database.

**IMPORTANT**: This is an INTERFACE/CONTRACT only.
The actual implementation is provided by the database implementation layer.

The preference elicitation agent uses this interface to:
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
    Youth profile schema for the youth database.

    This model represents a complete youth profile containing:
    - Past experiences (from skills elicitation process)
    - Skills vector (from skills elicitation process)
    - Preference vector (from preference elicitation process)
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
    Populated by skills elicitation agent.
    """

    skills_vector: Optional[dict[str, Any]] = None
    """
    Skills vector from skills elicitation process.
    Format defined by database implementation.
    """

    preference_vector: Optional[PreferenceVector] = None
    """
    Preference vector from preference elicitation agent.
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
    Abstract interface for the youth database client.

    **IMPLEMENTATION**: The database implementation layer provides the concrete implementation.
    **USAGE**: Preference elicitation, recommendation, and skills elicitation agents use this interface.

    Expected implementation location:
    - compass/backend/app/database_contracts/db6_youth_database/db6_client_impl.py

    The implementation should:
    - Store profiles in MongoDB (or agreed database)
    - Use existing backend database connection patterns
    - Handle concurrent access safely
    - Log errors appropriately
    - Follow existing error handling patterns

    Example usage:
    ```python
    db6_client = get_db6_client()  # Factory provided by database layer

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
        raise NotImplementedError("Database implementation must provide this method")

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
        raise NotImplementedError("Database implementation must provide this method")

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
        raise NotImplementedError("Database implementation must provide this method")


# Stub implementation for development/testing
class StubDB6Client(DB6Client):
    """
    Stub implementation for development and testing when youth database is not available.

    This is a simple in-memory implementation that:
    - Stores profiles in a dictionary
    - Provides the same interface as the real youth database client
    - Allows agent development to proceed without database dependency

    **NOT FOR PRODUCTION USE** - This is replaced by the actual database implementation.
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
