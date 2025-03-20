import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from app.version.types import Version
from app.version.version_routes import add_version_routes
from app.app_config import ApplicationConfig


@pytest.fixture(scope="function")
def _create_test_client() -> TestClient:
    # Set up the FastAPI
    app = FastAPI()

    # Add the feedback routes to the conversations router
    add_version_routes(app)

    # Create a test client
    client = TestClient(app)

    return client


class TestVersionRoutes:
    @pytest.mark.asyncio
    async def test_get_version(self, _create_test_client: TestClient, setup_application_config: ApplicationConfig):
        client = _create_test_client

        # WHEN a GET request
        actual_response = client.get("/version")

        # THEN the response is OK
        assert actual_response.status_code == 200
        # AND the response contains the version information
        assert Version(**actual_response.json()) == setup_application_config.version_info
