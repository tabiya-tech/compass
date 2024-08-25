from unittest.mock import patch

from motor.motor_asyncio import AsyncIOMotorClient

from conftest import random_db_name


def test_version(in_memory_mongo_server):
    """
    Integration test for the backend server application.
    It will spin up the FastAPI application with an in memory db for the applications db and test the version endpoint.
    """

    # Using an in-memory MongoDB server for testing

    # create a random db name to ensure isolation
    _in_mem_application_db = AsyncIOMotorClient(
        in_memory_mongo_server.connection_string,
        tlsAllowInvalidCertificates=True
    ).get_database(random_db_name())

    with patch('app.server_dependencies.db_dependencies._get_application_db') as mock_get_application_db:
        mock_get_application_db.return_value = _in_mem_application_db

        from fastapi.testclient import TestClient
        from app.server import app
        # We need to use the TestClient as a context manager to ensure
        # that the application's lifecycle startup and shutdown events are triggered.
        # Otherwise, we cannot be sure that the application is fully started and the test is too "shallow".
        with TestClient(app) as client:
            """
            Test the version endpoint
            WHEN a GET request is made to the version endpoint
            THEN it should return with OK
            :return:
            """
            response = client.get("/version")
            assert response.status_code == 200
