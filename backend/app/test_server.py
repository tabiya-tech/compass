import pytest


@pytest.mark.asyncio
async def test_version(
        in_memory_mongo_server,
        mocker,
        mocked_users_database,
        mocked_application_database,
        mock_taxonomy_database):
    """
    Integration test for the backend server application.
    It will spin up the FastAPI application with an in memory db for the applications db and test the version endpoint.
    """

    # Using an in-memory MongoDB server for testing

    # create a random db name to ensure isolation
    _in_mem_application_db = mocker.patch('app.server_dependencies.db_dependencies._get_application_db')
    _in_mem_application_db.return_value = await mocked_application_database

    _in_mem_users_db = mocker.patch('app.server_dependencies.db_dependencies._get_users_db')
    _in_mem_users_db.return_value = await mocked_users_database

    _in_mem_taxonomy_db = mocker.patch('app.server_dependencies.db_dependencies._get_taxonomy_db')
    _in_mem_taxonomy_db.return_value = await mock_taxonomy_database

    from fastapi.testclient import TestClient
    from app.server import app

    client = TestClient(app)
    response = client.get("/version")
    assert response.status_code == 200

    # close the client
    client.close()
