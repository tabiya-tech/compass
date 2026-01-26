import json
import os
from datetime import datetime, timezone
from http import HTTPStatus
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import quote

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport

from app.users.cv.routes import add_public_report_routes
from app.users.cv.rate_limiter import bulk_download_rate_limiter
from app.users.repositories import IUserPreferenceRepository
from app.conversations.experience.service import IExperienceService
from app.conversations.experience.get_experience_service import get_experience_service
from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.types import UserPreferences
from app.agent.experience import ExperienceEntity
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement


@pytest.fixture
def app():  # pylint: disable=missing-function-docstring
    app_instance = FastAPI()
    add_public_report_routes(app_instance)
    return app_instance


@pytest.fixture(autouse=True)
def setup_environment():
    """Set up environment variables for testing."""
    # Set SEC_TOKEN for all tests
    os.environ["SEC_TOKEN"] = "valid-token"
    yield
    # Clean up
    if "SEC_TOKEN" in os.environ:
        del os.environ["SEC_TOKEN"]
    # Reset rate limiter between tests
    bulk_download_rate_limiter._requests.clear()


@pytest.fixture
def mock_experience_entity():
    """Create a mock experience entity."""
    mock_entity = MagicMock(spec=ExperienceEntity)
    mock_entity.uuid = "exp-123"
    mock_entity.experience_title = "Software Developer"
    mock_entity.company = "Tech Company"
    mock_entity.timeline = None
    mock_entity.work_type = None
    mock_entity.top_skills = []
    mock_entity.remaining_skills = []
    mock_entity.summary = "Developed software"
    return mock_entity


@pytest.mark.asyncio
async def test_stream_reports_success(app, mock_experience_entity):  # pylint: disable=redefined-outer-name
    """Test successful streaming of reports."""
    # Setup mocks
    mock_pref_repo = MagicMock(spec=IUserPreferenceRepository)
    mock_exp_service = MagicMock(spec=IExperienceService)

    # Mock phase
    mock_phase = MagicMock()
    mock_phase.name = "PROCESSED"

    # Create user preferences batch
    user_pref = UserPreferences(
        user_id="user-1",
        registration_code="reg-code-1",
        language="en",
        sessions=[12345],
        accepted_tc=datetime.now(timezone.utc),
        sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
    )

    # Mock stream_user_preferences as async generator
    async def mock_stream(page_size, started_before, started_after):  # pylint: disable=unused-argument
        yield [user_pref]

    mock_pref_repo.stream_user_preferences = mock_stream

    # Mock experience service to return experiences for session IDs (plural method)
    mock_exp_service.get_experiences_by_session_ids = AsyncMock(
        return_value={12345: [(mock_experience_entity, mock_phase)]}
    )

    # Override dependencies
    app.dependency_overrides[get_user_preferences_repository] = lambda: mock_pref_repo
    app.dependency_overrides[get_experience_service] = lambda: mock_exp_service

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/reports?page_size=10&token=valid-token")

    assert response.status_code == HTTPStatus.OK
    assert response.headers["content-type"] == "application/x-ndjson"

    # Parse NDJSON response - now expects batches (arrays)
    lines = response.text.strip().split("\n")
    assert len(lines) >= 1

    # Parse first batch (should be an array)
    first_batch = json.loads(lines[0])
    assert isinstance(first_batch, list)
    assert len(first_batch) >= 1

    # Check first report in the batch
    first_report = first_batch[0]
    assert first_report["user_id"] == "user-1"
    assert first_report["registration_code"] == "reg-code-1"
    assert isinstance(first_report["experiences"], list)


@pytest.mark.asyncio
async def test_stream_reports_with_token_validation(app):  # pylint: disable=redefined-outer-name
    """Test that the endpoint requires a valid token when SEC_TOKEN is set."""
    mock_pref_repo = MagicMock(spec=IUserPreferenceRepository)
    mock_exp_service = MagicMock(spec=IExperienceService)

    app.dependency_overrides[get_user_preferences_repository] = lambda: mock_pref_repo
    app.dependency_overrides[get_experience_service] = lambda: mock_exp_service

    with patch.dict(os.environ, {"SEC_TOKEN": "valid-token"}):
        # Reset rate limiter for this test
        bulk_download_rate_limiter._requests.clear()
        
        # Test without token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/reports?page_size=10")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json()["detail"] == "Security token required"

        # Test with invalid token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/reports?page_size=10&token=invalid-token")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json()["detail"] == "Invalid security token"


@pytest.mark.asyncio
async def test_stream_reports_with_valid_token(app):  # pylint: disable=redefined-outer-name
    """Test streaming reports with valid token."""
    mock_pref_repo = MagicMock(spec=IUserPreferenceRepository)
    mock_exp_service = MagicMock(spec=IExperienceService)

    # Mock stream_user_preferences as async generator returning empty
    async def mock_stream(page_size, started_before, started_after):  # pylint: disable=unused-argument
        return
        yield  # Make it a generator  # pylint: disable=unreachable

    mock_pref_repo.stream_user_preferences = mock_stream

    app.dependency_overrides[get_user_preferences_repository] = lambda: mock_pref_repo
    app.dependency_overrides[get_experience_service] = lambda: mock_exp_service

    with patch.dict(os.environ, {"SEC_TOKEN": "valid-token"}):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/reports?page_size=10&token=valid-token")

        assert response.status_code == HTTPStatus.OK


@pytest.mark.asyncio
async def test_stream_reports_with_date_filters(app):  # pylint: disable=redefined-outer-name
    """Test streaming reports with date filters."""
    mock_pref_repo = MagicMock(spec=IUserPreferenceRepository)
    mock_exp_service = MagicMock(spec=IExperienceService)

    # Track the query filter used
    captured_args = {}

    async def mock_stream(page_size, started_before, started_after):
        captured_args['page_size'] = page_size
        captured_args['started_before'] = started_before
        captured_args['started_after'] = started_after
        return
        yield  # Make it a generator  # pylint: disable=unreachable

    mock_pref_repo.stream_user_preferences = mock_stream

    app.dependency_overrides[get_user_preferences_repository] = lambda: mock_pref_repo
    app.dependency_overrides[get_experience_service] = lambda: mock_exp_service

    started_before = datetime(2025, 1, 20, 12, 0, 0, tzinfo=timezone.utc)
    started_after = datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(
            f"/reports?page_size=10&token=valid-token&started_before={quote(started_before.isoformat())}&started_after={quote(started_after.isoformat())}"
        )

    assert response.status_code == HTTPStatus.OK
    assert captured_args['started_before'] == started_before
    assert captured_args['started_after'] == started_after


@pytest.mark.asyncio
async def test_stream_reports_pagination(app, mock_experience_entity):  # pylint: disable=redefined-outer-name
    """Test that pagination works correctly."""
    mock_pref_repo = MagicMock(spec=IUserPreferenceRepository)
    mock_exp_service = MagicMock(spec=IExperienceService)

    # Mock phase
    mock_phase = MagicMock()
    mock_phase.name = "PROCESSED"

    # Create user preferences
    user_prefs = [
        UserPreferences(
            user_id=f"user-{i}",
            registration_code=f"reg-{i}",
            language="en",
            sessions=[i * 100],
            accepted_tc=datetime.now(timezone.utc),
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
        )
        for i in range(1, 3)
    ]

    # Mock stream_user_preferences as async generator
    async def mock_stream(page_size, started_before, started_after):  # pylint: disable=unused-argument
        yield user_prefs

    mock_pref_repo.stream_user_preferences = mock_stream

    # Mock experience service to return experiences for all session IDs
    mock_exp_service.get_experiences_by_session_ids = AsyncMock(
        return_value={
            100: [(mock_experience_entity, mock_phase)],
            200: [(mock_experience_entity, mock_phase)]
        }
    )

    app.dependency_overrides[get_user_preferences_repository] = lambda: mock_pref_repo
    app.dependency_overrides[get_experience_service] = lambda: mock_exp_service

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/reports?page_size=2&token=valid-token")

    assert response.status_code == HTTPStatus.OK

    # Parse NDJSON response - now expects batches (arrays)
    lines = response.text.strip().split("\n")
    assert len(lines) == 1  # One batch containing both users

    # Parse the batch
    batch = json.loads(lines[0])
    assert isinstance(batch, list)
    assert len(batch) == 2  # Two users in the batch

    # Verify both users are present
    user_ids = [report["user_id"] for report in batch]
    assert "user-1" in user_ids
    assert "user-2" in user_ids


@pytest.mark.asyncio
async def test_stream_reports_handles_missing_sessions(app):  # pylint: disable=redefined-outer-name
    """Test that users without sessions are skipped."""
    mock_pref_repo = MagicMock(spec=IUserPreferenceRepository)
    mock_exp_service = MagicMock(spec=IExperienceService)

    # Mock user with empty sessions
    user_pref = UserPreferences(
        user_id="user-no-sessions",
        registration_code="reg-code",
        language="en",
        sessions=[],  # Empty sessions
        sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
    )

    # Mock stream_user_preferences as async generator
    async def mock_stream(page_size, started_before, started_after):  # pylint: disable=unused-argument
        yield [user_pref]

    mock_pref_repo.stream_user_preferences = mock_stream

    app.dependency_overrides[get_user_preferences_repository] = lambda: mock_pref_repo
    app.dependency_overrides[get_experience_service] = lambda: mock_exp_service

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/reports?page_size=10&token=valid-token")

    assert response.status_code == HTTPStatus.OK
    # Should return empty stream since user has no sessions
    assert response.text.strip() == ""


@pytest.mark.asyncio
async def test_stream_reports_page_size_validation(app):  # pylint: disable=redefined-outer-name
    """Test that page_size parameter is validated."""
    mock_pref_repo = MagicMock(spec=IUserPreferenceRepository)
    mock_exp_service = MagicMock(spec=IExperienceService)

    app.dependency_overrides[get_user_preferences_repository] = lambda: mock_pref_repo
    app.dependency_overrides[get_experience_service] = lambda: mock_exp_service

    # Test page_size too small
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/reports?page_size=0&token=valid-token")

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    # Test page_size too large
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/reports?page_size=101&token=valid-token")

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_stream_reports_case_insensitive_token(app):  # pylint: disable=redefined-outer-name
    """Test that token comparison is case-insensitive."""
    mock_pref_repo = MagicMock(spec=IUserPreferenceRepository)
    mock_exp_service = MagicMock(spec=IExperienceService)

    # Mock stream_user_preferences as async generator returning empty
    async def mock_stream(page_size, started_before, started_after):  # pylint: disable=unused-argument
        return
        yield  # Make it a generator  # pylint: disable=unreachable

    mock_pref_repo.stream_user_preferences = mock_stream

    app.dependency_overrides[get_user_preferences_repository] = lambda: mock_pref_repo
    app.dependency_overrides[get_experience_service] = lambda: mock_exp_service

    with patch.dict(os.environ, {"SEC_TOKEN": "ValidToken"}):
        # Test with lowercase token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/reports?page_size=10&token=validtoken")

        assert response.status_code == HTTPStatus.OK

        # Test with uppercase token
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/reports?page_size=10&token=VALIDTOKEN")

        assert response.status_code == HTTPStatus.OK
