import uuid

import pytest
from datetime import datetime, timezone
from typing import Awaitable

from app.users.repositories import UserPreferenceRepository, UserPreferenceRepositoryError
from app.users.types import UserPreferences, UserPreferencesRepositoryUpdateRequest, PossibleExperimentValues
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement
from common_libs.test_utilities import get_random_printable_string
from common_libs.time_utilities import truncate_microseconds, mongo_date_to_datetime


@pytest.fixture(scope="function")
async def get_user_preference_repository(in_memory_application_database) -> UserPreferenceRepository:
    application_db = await in_memory_application_database
    repository = UserPreferenceRepository(application_db)
    return repository


@pytest.mark.asyncio
class TestGetUserPreferenceByUserId:
    async def test_get_user_preference_by_user_id_no_user(self, get_user_preference_repository: Awaitable[UserPreferenceRepository]):
        # GIVEN a user id that doesn't exist
        given_user_id = get_random_printable_string(10)
        repository = await get_user_preference_repository

        # WHEN getting the user preferences
        actual_user_preferences = await repository.get_user_preference_by_user_id(given_user_id)

        # THEN the user preferences should be None
        assert actual_user_preferences is None

    async def test_get_user_preference_by_user_id_database_error(self, get_user_preference_repository: Awaitable[UserPreferenceRepository], mocker):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)
        repository = await get_user_preference_repository

        # AND the database throws an error
        mocker.patch.object(repository.collection, 'find_one', side_effect=Exception("Database error"))

        # WHEN getting the user preferences
        # THEN a UserPreferenceRepositoryError should be thrown
        with pytest.raises(UserPreferenceRepositoryError):
            await repository.get_user_preference_by_user_id(given_user_id)


@pytest.mark.asyncio
class TestInsertUserPreference:
    async def test_insert_user_preference_successful(self, get_user_preference_repository: Awaitable[UserPreferenceRepository]):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a user preference
        given_user_preference = UserPreferences(
            language="en",
            client_id=uuid.uuid4().__str__(),
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
        )

        # AND a user preference repository
        repository = await get_user_preference_repository

        # WHEN inserting the user preferences
        actual_user_preferences = await repository.insert_user_preference(given_user_id, given_user_preference)

        # THEN the user preferences should be returned
        assert actual_user_preferences is not None
        assert actual_user_preferences.language == given_user_preference.language
        assert actual_user_preferences.client_id == given_user_preference.client_id
        assert actual_user_preferences.sensitive_personal_data_requirement == given_user_preference.sensitive_personal_data_requirement

        # AND the user preferences should be in the database
        actual_user_preferences = await repository.get_user_preference_by_user_id(given_user_id)
        assert actual_user_preferences is not None
        assert actual_user_preferences.language == given_user_preference.language
        assert actual_user_preferences.client_id == given_user_preference.client_id
        assert actual_user_preferences.sensitive_personal_data_requirement == given_user_preference.sensitive_personal_data_requirement

    async def test_insert_user_preference_database_error(self, get_user_preference_repository: Awaitable[UserPreferenceRepository], mocker):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a user preference
        given_user_preference = UserPreferences(
            language="en",
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
        )

        # AND a user preference repository
        repository = await get_user_preference_repository

        # AND the database throws an error
        mocker.patch.object(repository.collection, 'insert_one', side_effect=Exception("Database error"))

        # WHEN inserting the user preferences
        # THEN a UserPreferenceRepositoryError should be thrown
        with pytest.raises(UserPreferenceRepositoryError):
            await repository.insert_user_preference(given_user_id, given_user_preference)


@pytest.mark.asyncio
class TestUpdateUserPreference:
    async def test_update_user_preference_successful(self, get_user_preference_repository: Awaitable[UserPreferenceRepository]):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a user preference
        given_user_preference = UserPreferences(
            language="en",
            client_id=uuid.uuid4().__str__(),
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
        )

        # AND a user preference repository
        repository = await get_user_preference_repository

        # AND the user preference is inserted
        await repository.insert_user_preference(given_user_id, given_user_preference)

        # AND an update request with a fixed timestamp to avoid microsecond differences
        test_datetime = datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc)
        given_update = UserPreferencesRepositoryUpdateRequest(
            language="fr",
            accepted_tc=test_datetime
        )

        # WHEN updating the user preferences
        actual_user_preferences = await repository.update_user_preference(given_user_id, given_update)

        # THEN the user preferences should be returned
        assert actual_user_preferences is not None
        assert actual_user_preferences.language == given_update.language
        assert actual_user_preferences.client_id == given_user_preference.client_id # not update field should not be updated
        assert truncate_microseconds(mongo_date_to_datetime(actual_user_preferences.accepted_tc)) == truncate_microseconds(test_datetime)

        # AND the user preferences should be in the database
        actual_user_preferences = await repository.get_user_preference_by_user_id(given_user_id)
        assert actual_user_preferences is not None
        assert actual_user_preferences.language == given_update.language
        assert actual_user_preferences.client_id == given_user_preference.client_id # not update field should not be updated
        assert truncate_microseconds(mongo_date_to_datetime(actual_user_preferences.accepted_tc)) == truncate_microseconds(test_datetime)

    async def test_update_user_preference_database_error(self, get_user_preference_repository: Awaitable[UserPreferenceRepository], mocker):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a user preference
        given_user_preference = UserPreferences(
            language="en",
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
        )

        # AND a user preference repository
        repository = await get_user_preference_repository

        # AND the user preference is inserted
        await repository.insert_user_preference(given_user_id, given_user_preference)

        # AND an update request
        given_update = UserPreferencesRepositoryUpdateRequest(
            language="fr",
            accepted_tc=datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc)
        )

        # AND the database throws an error
        mocker.patch.object(repository.collection, 'update_one', side_effect=Exception("Database error"))

        # WHEN updating the user preferences
        # THEN a UserPreferenceRepositoryError should be thrown
        with pytest.raises(UserPreferenceRepositoryError):
            await repository.update_user_preference(given_user_id, given_update)


@pytest.mark.asyncio
class TestGetExperimentsByUserId:
    async def test_get_experiments_by_user_id_no_user(self, get_user_preference_repository: Awaitable[UserPreferenceRepository]):
        # GIVEN a user id that doesn't exist
        given_user_id = get_random_printable_string(10)

        # AND a user preference repository
        repository = await get_user_preference_repository

        # WHEN getting the experiments
        actual_experiments = await repository.get_experiments_by_user_id(given_user_id)

        # THEN an empty dict should be returned
        assert actual_experiments == {}

    async def test_get_experiments_by_user_id_with_experiments(self, get_user_preference_repository: Awaitable[UserPreferenceRepository]):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a user preference repository
        repository = await get_user_preference_repository

        # AND a user preference with experiments
        given_experiments = {
            "exp1": {"shown": True, "branch": 1},
            "exp2": {"enabled": False, "variant": "A"}
        }
        given_user_preference = UserPreferences(
            language="en",
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE,
            experiments=given_experiments
        )

        # AND the user preference is inserted
        await repository.insert_user_preference(given_user_id, given_user_preference)

        # WHEN getting the experiments
        actual_experiments = await repository.get_experiments_by_user_id(given_user_id)

        # THEN the experiments should match
        assert actual_experiments == given_experiments

    async def test_get_experiments_by_user_id_database_error(self, get_user_preference_repository: Awaitable[UserPreferenceRepository], mocker):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a user preference repository
        repository = await get_user_preference_repository

        # AND the database throws an error
        mocker.patch.object(repository.collection, 'find', side_effect=Exception("Database error"))

        # WHEN getting the experiments
        # THEN a UserPreferenceRepositoryError should be thrown
        with pytest.raises(UserPreferenceRepositoryError):
            await repository.get_experiments_by_user_id(given_user_id)


@pytest.mark.asyncio
class TestSetExperimentByUserId:
    @pytest.mark.parametrize("given_experiment_config", [
        {"shown": True, "branch": 1},
        {"parent": {"child": "value"}},
        "foo-flat-experiment",
        True,
        42,
        3.14,
        None,
        ["item1", "item2"],
        { "p": ["item1", "item2", { "nested_item": "value"}]}
    ], ids=[
        "dict_config",
        "nested_dict_config",
        "flat_string",
        "boolean",
        "integer",
        "float",
        "none",
        "flat_array",
        "object_with_array"
    ])
    async def test_set_experiment_by_user_id_new_experiment(self, get_user_preference_repository: Awaitable[UserPreferenceRepository], given_experiment_config: PossibleExperimentValues):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a user preference repository
        repository = await get_user_preference_repository

        # AND a user preference with no experiments
        given_user_preference = UserPreferences(
            language="en",
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
        )

        # AND the user preference is inserted
        await repository.insert_user_preference(given_user_id, given_user_preference)

        # WHEN setting an experiment
        given_experiment_id = "exp1"
        await repository.set_experiment_by_user_id(given_user_id, given_experiment_id, given_experiment_config)

        # THEN the experiment should be in the database
        actual_experiments = await repository.get_experiments_by_user_id(given_user_id)
        assert actual_experiments == {given_experiment_id: given_experiment_config}

    async def test_set_experiment_by_user_id_update_existing(self, get_user_preference_repository: Awaitable[UserPreferenceRepository]):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a user preference repository
        repository = await get_user_preference_repository

        # AND a user preference with an existing experiment
        given_experiments = {"exp1": {"shown": True, "branch": 1}}
        given_user_preference = UserPreferences(
            language="en",
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE,
            experiments=given_experiments
        )

        # AND the user preference is inserted
        await repository.insert_user_preference(given_user_id, given_user_preference)

        # WHEN updating the experiment
        given_experiment_id = "exp1"
        given_experiment_config = {"shown": False, "branch": 2}
        await repository.set_experiment_by_user_id(given_user_id, given_experiment_id, given_experiment_config)

        # THEN the experiment should be updated in the database
        actual_experiments = await repository.get_experiments_by_user_id(given_user_id)
        assert actual_experiments == {given_experiment_id: given_experiment_config}

    async def test_set_experiment_by_user_id_multiple_experiments(self, get_user_preference_repository: Awaitable[UserPreferenceRepository]):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a user preference repository
        repository = await get_user_preference_repository

        # AND a user preference with an existing experiment
        given_experiments = {"exp1": {"shown": True, "branch": 1}}
        given_user_preference = UserPreferences(
            language="en",
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE,
            experiments=given_experiments
        )

        # AND the user preference is inserted
        await repository.insert_user_preference(given_user_id, given_user_preference)

        # WHEN adding another experiment
        given_experiment_id = "exp2"
        given_experiment_config = {"enabled": False, "variant": "A"}
        await repository.set_experiment_by_user_id(given_user_id, given_experiment_id, given_experiment_config)

        # THEN both experiments should be in the database
        actual_experiments = await repository.get_experiments_by_user_id(given_user_id)
        assert actual_experiments == {**given_experiments, given_experiment_id: given_experiment_config}

    async def test_set_experiment_by_user_id_database_error(self, get_user_preference_repository: Awaitable[UserPreferenceRepository], mocker):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a user preference with no experiments
        given_experiment_id = "exp1"
        given_experiment_config = {"shown": True, "branch": 1}

        # AND a user preference repository
        repository = await get_user_preference_repository

        # AND the database throws an error
        mocker.patch.object(repository.collection, 'update_one', side_effect=Exception("Database error"))

        # WHEN setting an experiment
        # THEN a UserPreferenceRepositoryError should be thrown
        with pytest.raises(UserPreferenceRepositoryError):
            await repository.set_experiment_by_user_id(given_user_id, given_experiment_id, given_experiment_config)


@pytest.mark.asyncio
class TestGetExperimentsByUserIds:
    async def test_get_experiments_by_user_ids_no_users(self, get_user_preference_repository: Awaitable[UserPreferenceRepository]):
        # GIVEN a list of user ids that don't exist
        given_user_ids = [get_random_printable_string(10) for _ in range(3)]
        repository = await get_user_preference_repository

        # WHEN getting the experiments
        actual_experiments = await repository.get_experiments_by_user_ids(given_user_ids)

        # THEN an empty dict should be returned
        assert actual_experiments == {}

    async def test_get_experiments_by_user_ids_with_experiments(self, get_user_preference_repository: Awaitable[UserPreferenceRepository]):
        # GIVEN multiple user ids
        given_user_ids = [get_random_printable_string(10) for _ in range(3)]
        repository = await get_user_preference_repository

        # AND user preferences with different experiments for each user
        given_experiments = [
            {"exp1": {"shown": True, "branch": 1}, "exp2": {"enabled": False, "variant": "A"}},
            {"exp3": {"shown": False, "branch": 2}},
            {"exp4": {"enabled": True, "variant": "B"}, "exp5": {"shown": True, "branch": 3}},
            {"exp6": "foo-flat-experiment"}
        ]

        # AND the user preferences are inserted
        for user_id, experiments in zip(given_user_ids, given_experiments):
            given_user_preference = UserPreferences(
                language="en",
                sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE,
                experiments=experiments
            )
            await repository.insert_user_preference(user_id, given_user_preference)

        # WHEN getting the experiments
        actual_experiments = await repository.get_experiments_by_user_ids(given_user_ids)

        # THEN the experiments should match for each user
        for user_id, expected_experiments in zip(given_user_ids, given_experiments):
            assert actual_experiments[user_id] == expected_experiments

    async def test_get_experiments_by_user_ids_database_error(self, get_user_preference_repository: Awaitable[UserPreferenceRepository], mocker):
        # GIVEN a list of user ids
        given_user_ids = [get_random_printable_string(10) for _ in range(3)]
        repository = await get_user_preference_repository

        # AND the database throws an error
        mocker.patch.object(repository.collection, 'find', side_effect=Exception("Database error"))

        # WHEN getting the experiments
        # THEN a UserPreferenceRepositoryError should be thrown
        with pytest.raises(UserPreferenceRepositoryError):
            await repository.get_experiments_by_user_ids(given_user_ids)

    async def test_get_experiments_by_user_ids_with_duplicates(self, get_user_preference_repository: Awaitable[UserPreferenceRepository]):
        # GIVEN a list of user ids with duplicates
        given_user_id = get_random_printable_string(10)
        given_user_ids = [given_user_id, given_user_id, given_user_id]
        repository = await get_user_preference_repository

        # AND a user preference with experiments
        given_experiments = {
            "exp1": {"shown": True, "branch": 1},
            "exp2": {"enabled": False, "variant": "A"},
            "exp3": "foo-flat-experiment"
        }
        given_user_preference = UserPreferences(
            language="en",
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE,
            experiments=given_experiments
        )

        # AND the user preference is inserted
        await repository.insert_user_preference(given_user_id, given_user_preference)

        # WHEN getting the experiments with duplicate user ids
        actual_experiments = await repository.get_experiments_by_user_ids(given_user_ids)

        # THEN the experiments should be returned only once for the unique user id
        assert actual_experiments == {given_user_id: given_experiments}
