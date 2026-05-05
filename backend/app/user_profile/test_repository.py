"""
Tests for the UserProfileRepository class.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.user_profile.repository import UserProfileRepository


def _create_mock_db():
    """Create a mock AsyncIOMotorDatabase with a mock collection."""
    mock_db = MagicMock()
    mock_collection = AsyncMock()
    mock_db.get_collection.return_value = mock_collection
    return mock_db, mock_collection


class TestGetLatestSessionId:
    @pytest.mark.asyncio
    async def test_returns_last_session_id_when_user_has_sessions(self):
        # GIVEN a user with sessions in the user_preferences collection
        given_user_id = "user-123"
        given_sessions = [1, 2, 3]
        mock_application_db, mock_collection = _create_mock_db()
        mock_userdata_db, _ = _create_mock_db()
        mock_collection.find_one = AsyncMock(return_value={"sessions": given_sessions})
        repository = UserProfileRepository(application_db=mock_application_db, userdata_db=mock_userdata_db)

        # WHEN get_latest_session_id is called
        actual_session_id = await repository.get_latest_session_id(given_user_id)

        # THEN the last session_id is returned
        assert actual_session_id == 3
        # AND the collection is queried with the correct filter and projection
        mock_collection.find_one.assert_awaited_once_with(
            {"user_id": {"$eq": given_user_id}},
            {"sessions": 1, "_id": 0}
        )

    @pytest.mark.asyncio
    async def test_returns_none_when_user_has_no_sessions_field(self):
        # GIVEN a user document with no sessions field
        given_user_id = "user-456"
        mock_application_db, mock_collection = _create_mock_db()
        mock_userdata_db, _ = _create_mock_db()
        mock_collection.find_one = AsyncMock(return_value={"user_id": given_user_id})
        repository = UserProfileRepository(application_db=mock_application_db, userdata_db=mock_userdata_db)

        # WHEN get_latest_session_id is called
        actual_session_id = await repository.get_latest_session_id(given_user_id)

        # THEN None is returned
        assert actual_session_id is None

    @pytest.mark.asyncio
    async def test_returns_none_when_user_not_found(self):
        # GIVEN a user_id that does not exist in the collection
        given_user_id = "nonexistent-user"
        mock_application_db, mock_collection = _create_mock_db()
        mock_userdata_db, _ = _create_mock_db()
        mock_collection.find_one = AsyncMock(return_value=None)
        repository = UserProfileRepository(application_db=mock_application_db, userdata_db=mock_userdata_db)

        # WHEN get_latest_session_id is called
        actual_session_id = await repository.get_latest_session_id(given_user_id)

        # THEN None is returned
        assert actual_session_id is None

    @pytest.mark.asyncio
    async def test_returns_int_when_session_stored_as_string(self):
        # GIVEN a user with sessions stored as strings
        given_user_id = "user-789"
        given_sessions = ["10", "20", "30"]
        mock_application_db, mock_collection = _create_mock_db()
        mock_userdata_db, _ = _create_mock_db()
        mock_collection.find_one = AsyncMock(return_value={"sessions": given_sessions})
        repository = UserProfileRepository(application_db=mock_application_db, userdata_db=mock_userdata_db)

        # WHEN get_latest_session_id is called
        actual_session_id = await repository.get_latest_session_id(given_user_id)

        # THEN the last session_id is returned as an int
        assert actual_session_id == 30
        assert isinstance(actual_session_id, int)

    @pytest.mark.asyncio
    async def test_returns_none_when_session_id_is_non_numeric_string(self):
        # GIVEN a user with a malformed non-numeric session_id
        given_user_id = "user-malformed"
        given_sessions = [1, 2, "not-a-number"]
        mock_application_db, mock_collection = _create_mock_db()
        mock_userdata_db, _ = _create_mock_db()
        mock_collection.find_one = AsyncMock(return_value={"sessions": given_sessions})
        repository = UserProfileRepository(application_db=mock_application_db, userdata_db=mock_userdata_db)

        # WHEN get_latest_session_id is called
        actual_session_id = await repository.get_latest_session_id(given_user_id)

        # THEN None is returned because the session_id cannot be converted to int
        assert actual_session_id is None


class TestGetExploredExperiences:
    @pytest.mark.asyncio
    async def test_returns_explored_experiences_when_session_found(self):
        # GIVEN a session with explored experiences
        given_session_id = 42
        given_experiences = [
            {"title": "Software Engineer", "company": "Acme Corp", "skills": ["Python", "FastAPI"]},
            {"title": "Teacher", "company": "School", "skills": ["Communication"]},
        ]
        mock_application_db, mock_collection = _create_mock_db()
        mock_userdata_db, _ = _create_mock_db()
        mock_collection.find_one = AsyncMock(return_value={"explored_experiences": given_experiences})
        repository = UserProfileRepository(application_db=mock_application_db, userdata_db=mock_userdata_db)

        # WHEN get_explored_experiences is called
        actual_experiences = await repository.get_explored_experiences(given_session_id)

        # THEN the explored experiences list is returned
        assert actual_experiences == given_experiences
        # AND the collection is queried with the correct filter and projection
        mock_collection.find_one.assert_awaited_once_with(
            {"session_id": {"$eq": given_session_id}},
            {"explored_experiences": 1, "_id": 0}
        )

    @pytest.mark.asyncio
    async def test_returns_none_when_explored_experiences_is_empty(self):
        # GIVEN a session with an empty explored_experiences list
        given_session_id = 43
        mock_application_db, mock_collection = _create_mock_db()
        mock_userdata_db, _ = _create_mock_db()
        mock_collection.find_one = AsyncMock(return_value={"explored_experiences": []})
        repository = UserProfileRepository(application_db=mock_application_db, userdata_db=mock_userdata_db)

        # WHEN get_explored_experiences is called
        actual_experiences = await repository.get_explored_experiences(given_session_id)

        # THEN None is returned
        assert actual_experiences is None

    @pytest.mark.asyncio
    async def test_returns_none_when_session_not_found(self):
        # GIVEN a session_id that does not exist in the collection
        given_session_id = 999
        mock_application_db, mock_collection = _create_mock_db()
        mock_userdata_db, _ = _create_mock_db()
        mock_collection.find_one = AsyncMock(return_value=None)
        repository = UserProfileRepository(application_db=mock_application_db, userdata_db=mock_userdata_db)

        # WHEN get_explored_experiences is called
        actual_experiences = await repository.get_explored_experiences(given_session_id)

        # THEN None is returned
        assert actual_experiences is None


class TestGetExploredExperienceEntities:
    @pytest.mark.asyncio
    async def test_unwraps_tuple_format_skills(self):
        # GIVEN explored_experiences stored with tuple-format top_skills/remaining_skills,
        # the way upgrade_experience.py wraps them as (score, skill) before persisting.
        given_session_id = 42
        given_skill_dict = {
            "id": "skill-1",
            "UUID": "skill-uuid-1",
            "modelId": "model-1",
            "preferredLabel": "use food cutting tools",
            "altLabels": [],
            "description": "",
            "skillType": "skill/competence",
            "score": 0.9,
        }
        given_explored = [{
            "experience_title": "cook",
            "top_skills": [[0.9, given_skill_dict]],
            "remaining_skills": [[0.4, {**given_skill_dict, "UUID": "skill-uuid-2", "preferredLabel": "supervise the work of staff"}]],
        }]
        mock_application_db, mock_collection = _create_mock_db()
        mock_userdata_db, _ = _create_mock_db()
        mock_collection.find_one = AsyncMock(return_value={"explored_experiences": given_explored})
        repository = UserProfileRepository(application_db=mock_application_db, userdata_db=mock_userdata_db)

        # WHEN get_explored_experience_entities is called
        actual_entities = await repository.get_explored_experience_entities(given_session_id)

        # THEN one ExperienceEntity is returned with plain SkillEntity skills (no tuple wrapping)
        assert actual_entities is not None
        assert len(actual_entities) == 1
        actual = actual_entities[0]
        assert actual.experience_title == "cook"
        assert len(actual.top_skills) == 1
        assert actual.top_skills[0].UUID == "skill-uuid-1"
        assert actual.top_skills[0].preferredLabel == "use food cutting tools"
        assert len(actual.remaining_skills) == 1
        assert actual.remaining_skills[0].UUID == "skill-uuid-2"


class TestGetPersonalData:
    @pytest.mark.asyncio
    async def test_returns_data_dict_when_user_found(self):
        # GIVEN a user with personal data in the plain_personal_data collection
        given_user_id = "user-abc"
        given_data = {"program": "Computer Science", "school": "UNZA", "year": "3"}
        mock_application_db, _ = _create_mock_db()
        mock_userdata_db, mock_collection = _create_mock_db()
        mock_collection.find_one = AsyncMock(return_value={"data": given_data})
        repository = UserProfileRepository(application_db=mock_application_db, userdata_db=mock_userdata_db)

        # WHEN get_personal_data is called
        actual_data = await repository.get_personal_data(given_user_id)

        # THEN the personal data dict is returned
        assert actual_data == given_data
        # AND the collection is queried with the correct filter and projection
        mock_collection.find_one.assert_awaited_once_with(
            {"user_id": {"$eq": given_user_id}},
            {"data": 1, "_id": 0}
        )

    @pytest.mark.asyncio
    async def test_returns_none_when_user_not_found(self):
        # GIVEN a user_id that does not exist in the collection
        given_user_id = "nonexistent-user"
        mock_application_db, _ = _create_mock_db()
        mock_userdata_db, mock_collection = _create_mock_db()
        mock_collection.find_one = AsyncMock(return_value=None)
        repository = UserProfileRepository(application_db=mock_application_db, userdata_db=mock_userdata_db)

        # WHEN get_personal_data is called
        actual_data = await repository.get_personal_data(given_user_id)

        # THEN None is returned
        assert actual_data is None
