from datetime import timedelta
from http import HTTPStatus

import pytest
from fastapi import HTTPException

from app.app_config import ApplicationConfig, set_application_config
from app.countries import Country
from app.i18n.types import Locale
from app.invitations.repository import UserInvitationRepository
from app.invitations.types import InvitationType, UserInvitation
from app.users.auth import SignInProvider, UserInfo
from app.users.preferences import INVALID_INVITATION_CODE_MESSAGE, _create_user_preferences
from app.users.repositories import UserPreferenceRepository
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement
from app.users.types import CreateUserPreferencesRequest
from app.version.types import Version
from common_libs.time_utilities import get_now


class _NoopMetricsService:
    async def record_event(self, _event):  # pragma: no cover - trivial stub
        return None


@pytest.fixture(autouse=True)
def _app_config():
    cfg = ApplicationConfig(
        environment_name="test",
        version_info=Version(date="2025-01-01", branch="test", buildNumber="0", sha="deadbeef"),
        enable_metrics=False,
        default_country_of_user=Country.UNSPECIFIED,
        taxonomy_model_id="dummy",
        embeddings_service_name="dummy",
        embeddings_model_name="dummy",
        features={},
        experience_pipeline_config={},
        cv_storage_bucket="bucket",
        cv_max_uploads_per_user=1,
        cv_rate_limit_per_minute=1,
        default_language=Locale.EN,
    )
    set_application_config(cfg)
    yield
    set_application_config(None)


@pytest.mark.asyncio
async def test_secure_link_claim_and_duplicate_rejection(monkeypatch, in_memory_application_database):
    db = await in_memory_application_database
    invitations_repo = UserInvitationRepository(db)
    user_repo = UserPreferenceRepository(db)
    metrics = _NoopMetricsService()

    monkeypatch.setenv("SEC_TOKEN_CV", "token-abc")

    create_request = CreateUserPreferencesRequest(
        user_id="user-1",
        language="en",
        registration_code="reg-123",
        report_token="token-abc",
        client_id="client-1",
    )
    authed_user = UserInfo(
        user_id="user-1",
        name="User One",
        email="one@example.com",
        token="fake",
        sign_in_provider=SignInProvider.GOOGLE,
    )

    created = await _create_user_preferences(invitations_repo, user_repo, create_request, authed_user, metrics)

    assert created.registration_code == "reg-123"
    claim = await invitations_repo.get_claim_by_registration_code("reg-123")
    assert claim is not None and claim.claimed_user_id == "user-1"

    duplicate_request = CreateUserPreferencesRequest(
        user_id="user-2",
        language="en",
        registration_code="reg-123",
        report_token="token-abc",
        client_id="client-2",
    )
    duplicate_user = UserInfo(
        user_id="user-2",
        name="User Two",
        email="two@example.com",
        token="fake",
        sign_in_provider=SignInProvider.GOOGLE,
    )

    with pytest.raises(HTTPException) as excinfo:
        await _create_user_preferences(invitations_repo, user_repo, duplicate_request, duplicate_user, metrics)

    assert excinfo.value.status_code == HTTPStatus.BAD_REQUEST
    assert INVALID_INVITATION_CODE_MESSAGE in str(excinfo.value.detail)


@pytest.mark.asyncio
async def test_manual_shared_invitation_does_not_decrement_capacity(in_memory_application_database):
    db = await in_memory_application_database
    invitations_repo = UserInvitationRepository(db)
    user_repo = UserPreferenceRepository(db)
    metrics = _NoopMetricsService()

    now = get_now()
    invitation = UserInvitation(
        invitation_code="shared-1",
        allowed_usage=1,
        remaining_usage=1,
        valid_from=now - timedelta(hours=1),
        valid_until=now + timedelta(days=1),
        invitation_type=InvitationType.REGISTER,
        sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_REQUIRED,
    )
    await invitations_repo.upsert_many_invitations([invitation])

    request = CreateUserPreferencesRequest(
        user_id="user-10",
        language="en",
        invitation_code=invitation.invitation_code,
        client_id="client-10",
    )
    authed_user = UserInfo(
        user_id="user-10",
        name="User Ten",
        email="ten@example.com",
        token="fake",
        sign_in_provider=SignInProvider.GOOGLE,
    )

    created = await _create_user_preferences(invitations_repo, user_repo, request, authed_user, metrics)

    assert created.invitation_code == invitation.invitation_code
    stored = await invitations_repo._collection.find_one({"invitation_code": invitation.invitation_code})
    assert stored is not None
    assert stored.get("remaining_usage") == invitation.remaining_usage


@pytest.mark.asyncio
async def test_secure_link_requires_report_token(monkeypatch, in_memory_application_database):
    db = await in_memory_application_database
    invitations_repo = UserInvitationRepository(db)
    user_repo = UserPreferenceRepository(db)
    metrics = _NoopMetricsService()

    monkeypatch.setenv("SEC_TOKEN_CV", "token-abc")

    request = CreateUserPreferencesRequest(
        user_id="user-3",
        language="en",
        registration_code="reg-999",
        report_token=None,
        client_id="client-3",
    )
    authed_user = UserInfo(
        user_id="user-3",
        name="User Three",
        email="three@example.com",
        token="fake",
        sign_in_provider=SignInProvider.GOOGLE,
    )

    with pytest.raises(HTTPException) as excinfo:
        await _create_user_preferences(invitations_repo, user_repo, request, authed_user, metrics)

    assert excinfo.value.status_code == HTTPStatus.UNAUTHORIZED
    assert "Security token required" in str(excinfo.value.detail)