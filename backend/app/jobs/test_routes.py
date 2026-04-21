from http import HTTPStatus
from typing import Optional

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.jobs.get_job_service import get_job_service
from app.jobs.routes import add_jobs_routes
from app.jobs.service import IJobService, JobDocument, JobStats
from app.analytics.types import PaginatedListMeta, PaginatedListResponse


class _MockJobService(IJobService):
    async def get_job_stats(self) -> JobStats:
        return JobStats(total=0, sectors=0, platforms=0)

    async def list_jobs(
        self,
        search: Optional[str],
        category: Optional[str],
        employment_type: Optional[str],
        location: Optional[str],
        days: Optional[int],
        cursor: Optional[str],
        limit: int,
        sort_by: Optional[str],
        sort_dir: str,
        include: Optional[str],
    ) -> PaginatedListResponse[JobDocument]:
        return PaginatedListResponse(
            data=[{"title": "Engineer"}],
            meta=PaginatedListMeta(limit=limit, next_cursor=None, has_more=False, total=None),
        )


@pytest.fixture(scope="function")
def client_with_mock_service() -> tuple[TestClient, _MockJobService]:
    service = _MockJobService()

    def _override_get_job_service() -> IJobService:
        return service

    app = FastAPI()
    app.dependency_overrides[get_job_service] = _override_get_job_service
    add_jobs_routes(app)
    client = TestClient(app)
    return client, service


class TestJobsRoutes:
    def test_get_jobs_returns_paginated_response(self, client_with_mock_service: tuple[TestClient, _MockJobService]):
        # GIVEN route registered with mocked service
        client, _ = client_with_mock_service

        # WHEN GET /jobs is called
        response = client.get("/jobs")

        # THEN response is 200 and returns data/meta shape
        assert response.status_code == HTTPStatus.OK
        body = response.json()
        assert body["data"][0]["title"] == "Engineer"
        assert body["meta"]["limit"] == 20
        assert body["meta"]["has_more"] is False

    def test_get_jobs_maps_runtime_error_to_500(self, client_with_mock_service: tuple[TestClient, _MockJobService], monkeypatch):
        # GIVEN service raises RuntimeError
        client, service = client_with_mock_service

        async def _raise_runtime_error(*_args, **_kwargs):
            raise RuntimeError("db down")

        monkeypatch.setattr(service, "list_jobs", _raise_runtime_error)

        # WHEN GET /jobs is called
        response = client.get("/jobs")

        # THEN route maps to 500 with runtime message
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
        assert response.json()["detail"] == "db down"

    def test_get_jobs_preserves_http_exception(self, client_with_mock_service: tuple[TestClient, _MockJobService], monkeypatch):
        # GIVEN service raises HTTPException (e.g., invalid cursor)
        client, service = client_with_mock_service

        async def _raise_http_exception(*_args, **_kwargs):
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Invalid cursor")

        monkeypatch.setattr(service, "list_jobs", _raise_http_exception)

        # WHEN GET /jobs is called
        response = client.get("/jobs?cursor=bad")

        # THEN HTTPException is propagated as-is
        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json()["detail"] == "Invalid cursor"
