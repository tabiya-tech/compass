import httpx
import json
import os


def test_version_info():
    # GIVEN the base URL of the deployed service
    base_url = os.environ.get("E2E_BASE_URL")
    # AND the expected version info, a JSON string
    expected_version = os.environ.get("EXPECTED_VERSION_INFO")
    version_json = json.loads(expected_version)

    # WHEN the client requests the version info
    client = httpx.Client(base_url=base_url)
    response = client.get("/version")

    # THEN the response should be successful
    assert response.status_code == 200
    # AND the response should contain the expected version info
    response_json = response.json()
    assert version_json.get("sha") == response_json.get("version").get("sha")
