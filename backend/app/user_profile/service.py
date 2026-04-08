"""
Service layer for the User Profile module.

Provides an interface and implementation for aggregating user profile data
from experiences (Skills & Interests) and registration (personal data).
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Optional

from app.user_profile.repository import IUserProfileRepository
from app.user_profile.types import ExperienceSummary, UserProfileData

MAX_SKILLS_PER_EXPERIENCE = 5
MAX_EXPERIENCES = 5


class IUserProfileService(ABC):
    """
    Interface for the User Profile Service.

    Allows mocking the service in tests.
    """

    @abstractmethod
    async def get_user_profile(self, user_id: str) -> Optional[UserProfileData]:
        """
        Get the aggregated user profile for a user.

        :param user_id: user_id
        :return: UserProfileData or None if no data found
        """
        raise NotImplementedError()

    @abstractmethod
    def format_for_prompt(self, profile: UserProfileData) -> str:
        """
        Format the user profile data into a text block suitable for LLM prompt injection.

        :param profile: the user profile data
        :return: formatted string
        """
        raise NotImplementedError()


class UserProfileService(IUserProfileService):
    def __init__(self, repository: IUserProfileRepository):
        self._repository = repository
        self._logger = logging.getLogger(UserProfileService.__name__)

    async def get_user_profile(self, user_id: str) -> Optional[UserProfileData]:
        session_id = await self._repository.get_latest_session_id(user_id)

        experiences_raw: Optional[list[dict]] = None
        personal_data: Optional[dict] = None

        if session_id is not None:
            # Fetch experiences and personal data in parallel
            experiences_raw, personal_data = await asyncio.gather(
                self._repository.get_explored_experiences(session_id),
                self._repository.get_personal_data(user_id),
            )
        else:
            # No session found — only personal data may exist
            personal_data = await self._repository.get_personal_data(user_id)

        if not experiences_raw and not personal_data:
            return None

        # Convert raw experiences to ExperienceSummary, limited to the 5 most recent
        experiences = self._build_experience_summaries(experiences_raw or [])

        return UserProfileData(
            experiences=experiences,
            personal_data=personal_data or {},
        )

    def format_for_prompt(self, profile: UserProfileData) -> str:
        sections: list[str] = ["## USER PROFILE (from previous conversations)"]

        # Programme section — only include if personal_data has relevant fields
        programme_parts = self._build_programme_line(profile.personal_data)
        if programme_parts:
            sections.append("")
            sections.append(f"**Programme**: {programme_parts}")

        # Experiences section — only include if there are experiences
        if profile.experiences:
            sections.append("")
            sections.append("**Explored Experiences & Skills**:")
            for exp in profile.experiences:
                skills_str = ", ".join(exp.skills)
                if exp.company:
                    sections.append(f"- {exp.title} ({exp.company}): {skills_str}")
                else:
                    sections.append(f"- {exp.title}: {skills_str}")

        sections.append("")
        sections.append(
            "IMPORTANT: When the user asks about their skills, reference the specific skills listed above. "
            "Do NOT repeat this profile to the user — use it naturally in your responses."
        )

        return "\n".join(sections)

    @staticmethod
    def _build_experience_summaries(raw_experiences: list[dict]) -> list[ExperienceSummary]:
        """Convert raw experience dicts to ExperienceSummary models, limited to the most recent."""
        # Take the last MAX_EXPERIENCES (most recent)
        recent = raw_experiences[-MAX_EXPERIENCES:]

        summaries: list[ExperienceSummary] = []
        for exp in recent:
            # Extract skill labels from top_skills: each element is [rank_int, skill_dict]
            top_skills_raw = exp.get("top_skills", [])
            skill_labels = [
                entry[1]["preferredLabel"]
                for entry in top_skills_raw[:MAX_SKILLS_PER_EXPERIENCE]
                if len(entry) >= 2 and isinstance(entry[1], dict) and "preferredLabel" in entry[1]
            ]

            summaries.append(
                ExperienceSummary(
                    title=exp.get("experience_title", ""),
                    company=exp.get("company"),
                    work_type=exp.get("work_type"),
                    skills=skill_labels,
                )
            )

        return summaries

    @staticmethod
    def _build_programme_line(personal_data: dict) -> str:
        """Build the programme line from personal data fields, or return empty string if none present."""
        program = personal_data.get("programme_name", "")
        year = personal_data.get("school_year", "")
        school = personal_data.get("institution_name", "")

        if not program and not year and not school:
            return ""

        parts: list[str] = []
        if program:
            parts.append(str(program))
        if year:
            parts.append(f"Year {year}")
        if school:
            parts.append(str(school))

        return ", ".join(parts)
