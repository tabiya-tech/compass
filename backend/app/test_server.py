from typing import Awaitable

import pytest
import pytest_mock
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from common_libs.test_utilities.setup_env_vars import setup_env_vars, teardown_env_vars


class TestServer:
    # on test startup we need to set up the env variables
    # on cleanup we need to remove the env variables
    @pytest.fixture(scope="function")
    def setup_env(self):
        setup_env_vars()
        yield
        teardown_env_vars()

    @pytest.mark.asyncio
    async def test_server_up(self,
                             in_memory_userdata_database: Awaitable[AsyncIOMotorDatabase],
                             in_memory_taxonomy_database: Awaitable[AsyncIOMotorDatabase],
                             in_memory_application_database: Awaitable[AsyncIOMotorDatabase],
                             in_memory_metrics_database: Awaitable[AsyncIOMotorDatabase],
                             mocker: pytest_mock.MockFixture,
                             setup_env: None
                             ):
        """
        Integration test for the backend server application.
        It will spin up the FastAPI application with an in memory db for the applications db and test the version endpoint.
        """

        # Mock the validate_taxonomy_model function to succeed
        # The mock must be created before the import of the app.server module
        mocker.patch('app.vector_search.validate_taxonomy_model.validate_taxonomy_model', return_value=None)

        # NOTE: Import the FastAPI application and the lifespan context manager first. This is crucial because
        # logging is configured during the app.server module's initialization. Logging configuration must be set
        # before any other imports; otherwise, it will not be applied, and logs will not be captured during the test.
        from app.server import app, lifespan

        # Using an in-memory MongoDB server for testing
        _in_mem_application_db = mocker.patch('app.server_dependencies.db_dependencies._get_application_db')
        _in_mem_application_db.return_value = await in_memory_application_database

        _in_mem_taxonomy_db = mocker.patch('app.server_dependencies.db_dependencies._get_taxonomy_db')
        _in_mem_taxonomy_db.return_value = await in_memory_taxonomy_database

        _in_mem_userdata_db = mocker.patch('app.server_dependencies.db_dependencies._get_userdata_db')
        _in_mem_userdata_db.return_value = await in_memory_userdata_database

        _in_mem_metrics_db = mocker.patch('app.server_dependencies.db_dependencies._get_metrics_db')
        _in_mem_metrics_db.return_value = await in_memory_metrics_database

        # Use httpx and AsyncClient to test the application asynchronously. This ensures the application
        # is fully started and properly shut down, as recommended for async tests in:
        # https://fastapi.tiangolo.com/advanced/async-tests/#async-tests
        # and https://fastapi.tiangolo.com/advanced/events/#lifespan-events
        #
        # NOTE: Using TestClient as a context manager is also an option. However, since it is not an async context manager,
        # if TestClient is used this way, the application's lifecycle startup and shutdown events will not occur
        # in the same event loop as the test. This can cause issues, especially with asynchronous code.
        async with lifespan(app):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:  # noqa
                """
                Test the version endpoint
                :return:
                """
                # WHEN a GET request is made to the version endpoint
                response = await c.get("/version")
                # THEN it should return with OK
                assert response.status_code == 200
                # AND the response should be a JSON object
                assert response.json() is not None
