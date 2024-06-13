import datetime
from unittest.mock import AsyncMock
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from pymongo.results import InsertOneResult

from app.users.types import datetime, UserPreferences, UserLanguage

from app.users.preferences import get_user_preferences, create_user_preferences, update_user_language

given_user_id = "foo"
given_language = "bar"
given_accepted_tc = datetime

given_user_preference = {
    "inserted_id": "foo-object-id",
    "user_id": given_user_id,
    "language": given_language,
    "accepted_tc": given_accepted_tc
}


class TestGetUserPreferences:
    @pytest.mark.asyncio
    @patch('app.users.repositories.UserPreferenceRepository.get_user_preference_by_user_id', new_callable=AsyncMock)
    async def test_get_user_preferences_not_found(self, mocker):
        # GIVEN a get_user_preference_by_user_id return value of None for the function being tested,
        mocker.return_value = None

        # WHEN the get_user_preferences function is called with the argument "foo" and raises an HTTPException,
        with pytest.raises(HTTPException) as exec_info:
            _response = await get_user_preferences("foo")

        # THEN the exception should contain "user not found" in its message and "404" in its status.
        assert "user not found" in str(exec_info.value)
        assert "404" in str(exec_info.value)

    @pytest.mark.asyncio
    async def test_get_user_preferences_user_id_missing(self):
        # GIVEN: The function `get_user_preferences` is called without a required parameter `user_id`
        with pytest.raises(TypeError) as exec_info:
            # WHEN: The `get_user_preferences` function is called without `user_id`
            _response = await get_user_preferences()

        # THEN: A `TypeError` is raised and the error message contains "user_id"
        assert "user_id" in str(exec_info.value)

    @pytest.mark.asyncio
    @patch('app.users.repositories.UserPreferenceRepository.get_user_preference_by_user_id', new_callable=AsyncMock)
    async def test_get_user_preferences_user_success(self, mocker):
        # GIVEN: A mocked return value for `get_user_preference_by_user_id`
        mocker.return_value = given_user_preference

        # WHEN: The `get_user_preferences` function is called with `given_user_id`
        response = await get_user_preferences(given_user_id)

        # THEN: The response should contain the correct user preferences
        assert response.get("accepted_tc") == given_accepted_tc
        assert response.get("language") == given_language


class TestCreateUserPreferences:
    @pytest.mark.asyncio
    @patch('app.users.repositories.UserPreferenceRepository.insert_user_preference', new_callable=AsyncMock)
    async def test_create_user_preferences_success(self, mocker):
        # GIVEN: A mocked return value for `create_user_preferences`
        given_inserted_id = "foo-object-id"
        mocker.return_value = InsertOneResult(inserted_id=given_inserted_id, acknowledged=True)

        # WHEN: The `create_user_preferences` function is called with user preferences data
        _response = await create_user_preferences(
            UserPreferences(user_id="foo", language="bar", accepted_tc=datetime.now()))

        # THEN: The response should contain the correct `user_preference_id`
        assert _response.get("user_preference_id") == given_inserted_id

    @pytest.mark.asyncio
    @patch('app.users.repositories.UserPreferenceRepository.get_user_preference_by_user_id', new_callable=AsyncMock)
    async def test_update_preferences_already_set(self, mocker):
        # GIVEN: A mocked return value indicating the user preference already exists
        mocker.return_value = given_user_preference

        # WHEN: The `create_user_preferences` function is called with user preferences data
        with pytest.raises(HTTPException) as exec_info:
            _response = await create_user_preferences(
                UserPreferences(user_id="foo", language="bar", accepted_tc=datetime.now()))

        # THEN: An `HTTPException` is raised with a message indicating the user already exists
        assert "user already exists" in str(exec_info.value)
        assert "409" in str(exec_info.value)


class TestUpdateLanguage:
    @pytest.mark.asyncio
    @patch('app.users.repositories.UserPreferenceRepository.get_user_preference_by_user_id', new_callable=AsyncMock)
    async def test_update_user_language_user_not_found(self, mocker):
        # GIVEN: A mocked return value indicating the user preference does not exist
        mocker.return_value = None

        # WHEN: The `get_user_preferences` function is called with a user ID that does not exist
        with pytest.raises(HTTPException) as exec_info:
            _response = await get_user_preferences("foo")

        # THEN: An `HTTPException` is raised with a message indicating the user is not found
        assert "user not found" in str(exec_info.value)
        assert "404" in str(exec_info.value)

    @pytest.mark.asyncio
    @patch('app.users.repositories.UserPreferenceRepository.get_user_preference_by_user_id', new_callable=AsyncMock)
    @patch('app.users.repositories.UserPreferenceRepository.update_user_preference', new_callable=AsyncMock)
    async def test_update_user_language_success(self, get_user_preferences_by_user_id, update_user_preference):
        # GIVEN: A mocked return value for getting user preference by user ID
        get_user_preferences_by_user_id.return_value = given_user_preference

        # AND: A mocked return value for updating the user preference
        update_user_preference.return_value = {
            "user_id": "foo"
        }

        # WHEN: The `update_user_language` function is called with user language data
        _response = await update_user_language(
            UserLanguage(user_id="foo", language="bar")
        )

        # THEN: The response should contain the correct `user_id`
        assert _response.get("user_id") == "foo"
