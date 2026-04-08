"""
Tests for the UserProfileService class.
"""

from typing import Optional
from unittest.mock import AsyncMock

import pytest

from app.user_profile.repository import IUserProfileRepository
from app.user_profile.service import UserProfileService
from app.user_profile.types import ExperienceSummary, UserProfileData


def _make_skill_entry(rank: int, label: str) -> list:
    """Helper to create a top_skills entry in the [rank, skill_dict] format."""
    return [rank, {"preferredLabel": label, "UUID": f"uuid-{label.lower().replace(' ', '-')}"}]


def _make_experience(
    title: str,
    company: Optional[str] = None,
    work_type: str = "WAGED_EMPLOYMENT",
    skill_labels: Optional[list[str]] = None,
) -> dict:
    """Helper to create a raw experience dict as returned from the repository."""
    skills = skill_labels or []
    top_skills = [_make_skill_entry(i + 1, label) for i, label in enumerate(skills)]
    return {
        "experience_title": title,
        "company": company,
        "work_type": work_type,
        "top_skills": top_skills,
        "remaining_skills": [],
    }


def _make_mock_repository(
    session_id: Optional[int] = None,
    experiences: Optional[list[dict]] = None,
    personal_data: Optional[dict] = None,
) -> IUserProfileRepository:
    """Create a mock IUserProfileRepository with the given return values."""
    mock = AsyncMock(spec=IUserProfileRepository)
    mock.get_latest_session_id.return_value = session_id
    mock.get_explored_experiences.return_value = experiences
    mock.get_personal_data.return_value = personal_data
    return mock


class TestGetUserProfile:
    """Tests for UserProfileService.get_user_profile"""

    @pytest.mark.asyncio
    async def test_returns_full_profile_when_experiences_and_personal_data_exist(self):
        # GIVEN a user with a session, explored experiences, and personal data
        given_user_id = "user-full-profile"
        given_session_id = 123
        given_experiences = [
            _make_experience("Electrician", company="ABC Company", skill_labels=["Electrical Wiring", "Safety Checks"]),
            _make_experience("Plumber", company="XYZ Ltd", skill_labels=["Pipe Fitting", "Water Systems"]),
        ]
        given_personal_data = {"programme_name": "Engineering", "school_year": "2", "institution_name": "UNZA"}
        mock_repo = _make_mock_repository(
            session_id=given_session_id,
            experiences=given_experiences,
            personal_data=given_personal_data,
        )
        service = UserProfileService(repository=mock_repo)

        # WHEN get_user_profile is called
        actual_profile = await service.get_user_profile(given_user_id)

        # THEN expect a UserProfileData with both experiences and personal data
        assert actual_profile is not None
        assert len(actual_profile.experiences) == 2
        assert actual_profile.experiences[0].title == "Electrician"
        assert actual_profile.experiences[0].company == "ABC Company"
        assert actual_profile.experiences[0].skills == ["Electrical Wiring", "Safety Checks"]
        assert actual_profile.experiences[1].title == "Plumber"
        assert actual_profile.personal_data == given_personal_data
        # AND expect the repository was called with the correct arguments
        mock_repo.get_latest_session_id.assert_awaited_once_with(given_user_id)
        mock_repo.get_explored_experiences.assert_awaited_once_with(given_session_id)
        mock_repo.get_personal_data.assert_awaited_once_with(given_user_id)

    @pytest.mark.asyncio
    async def test_returns_profile_with_experiences_only_when_no_personal_data(self):
        # GIVEN a user with a session and experiences but no personal data
        given_user_id = "user-experiences-only"
        given_session_id = 456
        given_experiences = [
            _make_experience("Teacher", company="School A", skill_labels=["Lesson Planning"]),
        ]
        mock_repo = _make_mock_repository(
            session_id=given_session_id,
            experiences=given_experiences,
            personal_data=None,
        )
        service = UserProfileService(repository=mock_repo)

        # WHEN get_user_profile is called
        actual_profile = await service.get_user_profile(given_user_id)

        # THEN expect a UserProfileData with experiences but empty personal_data
        assert actual_profile is not None
        assert len(actual_profile.experiences) == 1
        assert actual_profile.experiences[0].title == "Teacher"
        assert actual_profile.personal_data == {}

    @pytest.mark.asyncio
    async def test_returns_profile_with_personal_data_only_when_no_session(self):
        # GIVEN a user with no session (so no experiences) but with personal data
        given_user_id = "user-personal-data-only"
        given_personal_data = {"programme_name": "Business", "institution_name": "CBU"}
        mock_repo = _make_mock_repository(
            session_id=None,
            personal_data=given_personal_data,
        )
        service = UserProfileService(repository=mock_repo)

        # WHEN get_user_profile is called
        actual_profile = await service.get_user_profile(given_user_id)

        # THEN expect a UserProfileData with empty experiences and personal data present
        assert actual_profile is not None
        assert actual_profile.experiences == []
        assert actual_profile.personal_data == given_personal_data
        # AND expect get_explored_experiences was NOT called (no session)
        mock_repo.get_explored_experiences.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_returns_profile_with_personal_data_only_when_session_exists_but_no_experiences(self):
        # GIVEN a user with a session but no explored experiences, yet personal data exists
        given_user_id = "user-session-no-experiences"
        given_session_id = 789
        given_personal_data = {"programme_name": "IT", "school_year": "3", "institution_name": "UNZA"}
        mock_repo = _make_mock_repository(
            session_id=given_session_id,
            experiences=None,
            personal_data=given_personal_data,
        )
        service = UserProfileService(repository=mock_repo)

        # WHEN get_user_profile is called
        actual_profile = await service.get_user_profile(given_user_id)

        # THEN expect a UserProfileData with empty experiences but with personal data
        assert actual_profile is not None
        assert actual_profile.experiences == []
        assert actual_profile.personal_data == given_personal_data

    @pytest.mark.asyncio
    async def test_returns_none_when_no_data_at_all(self):
        # GIVEN a user with no session, no experiences, and no personal data
        given_user_id = "user-no-data"
        mock_repo = _make_mock_repository(
            session_id=None,
            experiences=None,
            personal_data=None,
        )
        service = UserProfileService(repository=mock_repo)

        # WHEN get_user_profile is called
        actual_profile = await service.get_user_profile(given_user_id)

        # THEN expect None to be returned
        assert actual_profile is None

    @pytest.mark.asyncio
    async def test_returns_none_when_session_exists_but_no_experiences_and_no_personal_data(self):
        # GIVEN a user with a session but no experiences and no personal data
        given_user_id = "user-empty-session"
        given_session_id = 999
        mock_repo = _make_mock_repository(
            session_id=given_session_id,
            experiences=None,
            personal_data=None,
        )
        service = UserProfileService(repository=mock_repo)

        # WHEN get_user_profile is called
        actual_profile = await service.get_user_profile(given_user_id)

        # THEN expect None to be returned
        assert actual_profile is None

    @pytest.mark.asyncio
    async def test_correctly_unwraps_top_skills_tuples_to_labels(self):
        # GIVEN an experience with top_skills in the [rank, skill_dict] tuple format
        given_user_id = "user-skills-unwrap"
        given_session_id = 100
        given_experiences = [
            {
                "experience_title": "Mechanic",
                "company": "Auto Shop",
                "work_type": "WAGED_EMPLOYMENT",
                "top_skills": [
                    [1, {"preferredLabel": "Engine Repair", "UUID": "uuid-1"}],
                    [2, {"preferredLabel": "Brake Systems", "UUID": "uuid-2"}],
                    [3, {"preferredLabel": "Diagnostics", "UUID": "uuid-3"}],
                ],
                "remaining_skills": [],
            }
        ]
        mock_repo = _make_mock_repository(
            session_id=given_session_id,
            experiences=given_experiences,
            personal_data=None,
        )
        service = UserProfileService(repository=mock_repo)

        # WHEN get_user_profile is called
        actual_profile = await service.get_user_profile(given_user_id)

        # THEN expect the skills to be correctly unwrapped to label strings
        assert actual_profile is not None
        expected_skills = ["Engine Repair", "Brake Systems", "Diagnostics"]
        assert actual_profile.experiences[0].skills == expected_skills

    @pytest.mark.asyncio
    async def test_limits_skills_to_max_five_per_experience(self):
        # GIVEN an experience with more than 5 top_skills
        given_user_id = "user-skill-limit"
        given_session_id = 200
        given_skill_labels = ["Skill A", "Skill B", "Skill C", "Skill D", "Skill E", "Skill F", "Skill G"]
        given_experiences = [
            _make_experience("Generalist", company="Big Corp", skill_labels=given_skill_labels),
        ]
        mock_repo = _make_mock_repository(
            session_id=given_session_id,
            experiences=given_experiences,
            personal_data=None,
        )
        service = UserProfileService(repository=mock_repo)

        # WHEN get_user_profile is called
        actual_profile = await service.get_user_profile(given_user_id)

        # THEN expect only the first 5 skills to be included
        assert actual_profile is not None
        assert len(actual_profile.experiences[0].skills) == 5
        expected_skills = ["Skill A", "Skill B", "Skill C", "Skill D", "Skill E"]
        assert actual_profile.experiences[0].skills == expected_skills

    @pytest.mark.asyncio
    async def test_limits_experiences_to_max_five_most_recent(self):
        # GIVEN a user with more than 5 experiences
        given_user_id = "user-experience-limit"
        given_session_id = 300
        given_experiences = [
            _make_experience(f"Job {i}", company=f"Company {i}", skill_labels=[f"Skill {i}"])
            for i in range(1, 8)  # 7 experiences
        ]
        mock_repo = _make_mock_repository(
            session_id=given_session_id,
            experiences=given_experiences,
            personal_data=None,
        )
        service = UserProfileService(repository=mock_repo)

        # WHEN get_user_profile is called
        actual_profile = await service.get_user_profile(given_user_id)

        # THEN expect only the last 5 experiences (most recent) to be included
        assert actual_profile is not None
        assert len(actual_profile.experiences) == 5
        # AND the experiences should be the last 5 from the original list
        expected_titles = ["Job 3", "Job 4", "Job 5", "Job 6", "Job 7"]
        actual_titles = [exp.title for exp in actual_profile.experiences]
        assert actual_titles == expected_titles


class TestFormatForPrompt:
    """Tests for UserProfileService.format_for_prompt"""

    def test_formats_full_profile_with_programme_and_experiences(self):
        # GIVEN a profile with personal data and experiences
        given_profile = UserProfileData(
            experiences=[
                ExperienceSummary(
                    title="Electrician",
                    company="ABC Company",
                    work_type="WAGED_EMPLOYMENT",
                    skills=["Electrical Wiring", "Safety Checks", "Circuit Design"],
                ),
                ExperienceSummary(
                    title="Plumber",
                    company="XYZ Ltd",
                    work_type="WAGED_EMPLOYMENT",
                    skills=["Pipe Fitting", "Water Systems"],
                ),
            ],
            personal_data={"programme_name": "Engineering", "school_year": "2", "institution_name": "UNZA"},
        )
        mock_repo = AsyncMock(spec=IUserProfileRepository)
        service = UserProfileService(repository=mock_repo)

        # WHEN format_for_prompt is called
        actual_result = service.format_for_prompt(given_profile)

        # THEN expect the result to contain the programme info
        assert "**Programme**: Engineering, Year 2, UNZA" in actual_result
        # AND the experiences with skills
        assert "- Electrician (ABC Company): Electrical Wiring, Safety Checks, Circuit Design" in actual_result
        assert "- Plumber (XYZ Ltd): Pipe Fitting, Water Systems" in actual_result
        # AND the header
        assert "## USER PROFILE (from previous conversations)" in actual_result
        # AND the important instruction line
        assert "IMPORTANT: When the user asks about their skills" in actual_result

    def test_formats_profile_with_experiences_only_when_no_personal_data(self):
        # GIVEN a profile with experiences but no personal data
        given_profile = UserProfileData(
            experiences=[
                ExperienceSummary(
                    title="Teacher",
                    company="School A",
                    skills=["Lesson Planning", "Classroom Management"],
                ),
            ],
            personal_data={},
        )
        mock_repo = AsyncMock(spec=IUserProfileRepository)
        service = UserProfileService(repository=mock_repo)

        # WHEN format_for_prompt is called
        actual_result = service.format_for_prompt(given_profile)

        # THEN expect the result to NOT contain a Programme section
        assert "**Programme**" not in actual_result
        # AND to contain the experiences section
        assert "- Teacher (School A): Lesson Planning, Classroom Management" in actual_result
        # AND the important instruction line
        assert "IMPORTANT:" in actual_result

    def test_formats_profile_with_programme_only_when_no_experiences(self):
        # GIVEN a profile with personal data but no experiences
        given_profile = UserProfileData(
            experiences=[],
            personal_data={"programme_name": "IT", "school_year": "1", "institution_name": "CBU"},
        )
        mock_repo = AsyncMock(spec=IUserProfileRepository)
        service = UserProfileService(repository=mock_repo)

        # WHEN format_for_prompt is called
        actual_result = service.format_for_prompt(given_profile)

        # THEN expect the result to contain the Programme section
        assert "**Programme**: IT, Year 1, CBU" in actual_result
        # AND to NOT contain the experiences section header
        assert "**Explored Experiences & Skills**" not in actual_result
        # AND the important instruction line
        assert "IMPORTANT:" in actual_result

    def test_formats_experience_without_company_omits_parentheses(self):
        # GIVEN a profile with an experience that has no company
        given_profile = UserProfileData(
            experiences=[
                ExperienceSummary(
                    title="Freelance Designer",
                    company=None,
                    skills=["Graphic Design", "Typography"],
                ),
            ],
            personal_data={},
        )
        mock_repo = AsyncMock(spec=IUserProfileRepository)
        service = UserProfileService(repository=mock_repo)

        # WHEN format_for_prompt is called
        actual_result = service.format_for_prompt(given_profile)

        # THEN expect the experience line to show title without parentheses
        assert "- Freelance Designer: Graphic Design, Typography" in actual_result
        # AND not contain empty parentheses
        assert "()" not in actual_result

    def test_important_instruction_line_is_always_present(self):
        # GIVEN any profile (even with minimal data)
        given_profile = UserProfileData(
            experiences=[],
            personal_data={"programme_name": "Science"},
        )
        mock_repo = AsyncMock(spec=IUserProfileRepository)
        service = UserProfileService(repository=mock_repo)

        # WHEN format_for_prompt is called
        actual_result = service.format_for_prompt(given_profile)

        # THEN expect the IMPORTANT instruction to be present
        assert "IMPORTANT: When the user asks about their skills, reference the specific skills listed above." in actual_result
        assert "Do NOT repeat this profile to the user" in actual_result

    def test_formats_partial_personal_data(self):
        # GIVEN a profile with only some personal data fields
        given_profile = UserProfileData(
            experiences=[],
            personal_data={"programme_name": "Nursing"},
        )
        mock_repo = AsyncMock(spec=IUserProfileRepository)
        service = UserProfileService(repository=mock_repo)

        # WHEN format_for_prompt is called
        actual_result = service.format_for_prompt(given_profile)

        # THEN expect only the available field in the Programme line
        assert "**Programme**: Nursing" in actual_result
        # AND not contain "Year" or extra commas
        assert "Year" not in actual_result
