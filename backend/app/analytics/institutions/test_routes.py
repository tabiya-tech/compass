from http import HTTPStatus
from unittest.mock import AsyncMock

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app.analytics.institutions.repository import get_institution_repository
from app.analytics.institutions.routes import add_institutions_routes
from app.analytics.types import Institution
from common_libs.test_utilities.mock_auth import MockAuth


class _MockInstitutionRepository:
    def __init__(self):
        self.list_institutions = AsyncMock(
            return_value=(
                [
                    Institution(
                        id="inst-1",
                        name="Institution 1",
                        active=True,
                        students=10,
                        active_7_days=5,
                        skills_discovery_started_pct=50.0,
                        skills_discovery_completed_pct=40.0,
                        career_readiness_started_pct=30.0,
                        career_readiness_completed_pct=20.0,
                        career_explorer_started_pct=10.0,
                    )
                ],
                None,
                False,
            )
        )
        self.count_institutions = AsyncMock(return_value=123)


@pytest.fixture(scope="function")
def client_with_mock_repo() -> tuple[TestClient, _MockInstitutionRepository]:
    repository = _MockInstitutionRepository()
    app = FastAPI()

    app.dependency_overrides[get_institution_repository] = lambda: repository
    router = APIRouter(prefix="/analytics", tags=["analytics"])
    add_institutions_routes(router, MockAuth())
    app.include_router(router)

    return TestClient(app), repository


class TestInstitutionRoutes:
    def test_page_query_enables_count_and_maps_to_cursor(
        self, client_with_mock_repo: tuple[TestClient, _MockInstitutionRepository]
    ):
        # GIVEN a page-based request
        client, repository = client_with_mock_repo

        # WHEN endpoint is called with page=3, limit=20
        response = client.get("/analytics/institutions?page=3&limit=20")

        # THEN response is successful and route uses encoded offset cursor
        assert response.status_code == HTTPStatus.OK
        repository.list_institutions.assert_awaited_once()
        kwargs = repository.list_institutions.await_args.kwargs
        assert kwargs["cursor"] == "NDA"
        assert kwargs["limit"] == 20
        repository.count_institutions.assert_awaited_once()
        assert response.json()["meta"]["total"] == 123

    def test_cursor_mode_does_not_force_count(self, client_with_mock_repo: tuple[TestClient, _MockInstitutionRepository]):
        # GIVEN a cursor-based request without include=count
        client, repository = client_with_mock_repo

        # WHEN endpoint is called without page or include
        response = client.get("/analytics/institutions?limit=20")

        # THEN route does not request a total count
        assert response.status_code == HTTPStatus.OK
        repository.count_institutions.assert_not_awaited()

    def test_page_query_rejects_invalid_page(self, client_with_mock_repo: tuple[TestClient, _MockInstitutionRepository]):
        # GIVEN invalid page index
        client, repository = client_with_mock_repo

        # WHEN endpoint is called with page=0
        response = client.get("/analytics/institutions?page=0")

        # THEN request is rejected and repository is not called
        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json()["detail"] == "Invalid page"
        repository.list_institutions.assert_not_awaited()
