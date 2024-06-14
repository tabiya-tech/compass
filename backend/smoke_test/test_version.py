import json
import os

import httpx
import pytest


@pytest.mark.smoke_test
def test_version_info():
    """
    Test that the version info endpoint returns the expected version info.
    """
    # GIVEN the base URL of the deployed service
    base_url = os.environ.get("E2E_BASE_URL")
    # AND the expected version info, a JSON string
    expected_version = os.environ.get("EXPECTED_VERSION_INFO")
    version_json = json.loads(expected_version)
    # AND the url for getting the version
    get_version_url = os.environ.get("GET_VERSION_URL")

    # WHEN the client requests the version info
    client = httpx.Client(base_url=base_url, timeout=25.0)
    try:
        response = client.get(get_version_url)
    except httpx.RequestError as e:
        pytest.fail(f"Request failed: {e}")

    # THEN the response should be successful
    assert response.status_code == 200
    # AND the response should contain the expected version info
    response_json = response.json()
    assert version_json.get("sha") == response_json.get("sha")