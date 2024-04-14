"""
Integration tests for the backend server application.
It will spin up the FastAPI application and test the endpoints.
"""
from fastapi.testclient import TestClient

from app.server import app

client = TestClient(app)


def test_read_main():
    """
    Test the root endpoint
    WHEN a GET request is made to the root endpoint
    THEN it should return withO OK
    AND a JSON response with the message "Hello Tabiya"
    :return:
    """
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"msg":"Hello Tabiya"}
