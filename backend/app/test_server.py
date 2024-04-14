"""
Integration tests for the backend server application.
It will spin up the FastAPI application and test the endpoints.
"""
from fastapi.testclient import TestClient

from app.server import app

client = TestClient(app)


def test_version():
    """
    Test the version endpoint
    WHEN a GET request is made to the version endpoint
    THEN it should return with OK
    :return:
    """
    response = client.get("/version")
    assert response.status_code == 200
