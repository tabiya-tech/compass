from datetime import datetime, timezone

import pytest

from common_libs.test_utilities import get_random_session_id
from common_libs.time_utilities import get_now, convert_python_datetime_to_mongo_datetime
from features.skills_ranking.state._test_utilities import get_skills_ranking_state
from features.skills_ranking.state.repositories.skills_ranking_state_repository import SkillsRankingStateRepository
from features.skills_ranking.state.services.type import (SkillsRankingState, SkillRankingExperimentGroup,
                                                         SkillsRankingPhase, UpdateSkillsRankingRequest)


def _assert_skills_ranking_state_fields_match(given_state: SkillsRankingState, actual_stored_state: dict) -> None:
    # Remove MongoDB _id if present
    typed_stored_dict = SkillsRankingStateRepository._from_db_doc(actual_stored_state)
    assert typed_stored_dict.model_dump() == given_state.model_dump()


fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)


class TestSkillsRankingRepository:
    class TestGetBySessionId:
        """
        Tests for the get_by_session_id method of SkillsRankingRepository.
        """

        @pytest.mark.asyncio
        async def test_get_by_session_id_not_found(self, in_memory_skills_ranking_state_db):
            # GIVEN a repository and a collection_name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            # WHEN getting a non-existent state
            state = await repository.get_by_session_id(1)

            # THEN the state is None
            assert state is None

        @pytest.mark.asyncio
        async def test_get_by_session_id_found(self, in_memory_skills_ranking_state_db):
            # GIVEN a repository and a collection name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            # AND given a session id
            given_session_id = get_random_session_id()

            # AND a state in the database
            given_state = get_skills_ranking_state(given_session_id)
            await repository.create(given_state)

            # WHEN getting the state
            state = await repository.get_by_session_id(given_session_id)

            # THEN the state is returned
            assert state is not None
            assert state.session_id == given_state.session_id

        @pytest.mark.asyncio
        async def test_get_by_session_id_db_error(self, in_memory_skills_ranking_state_db, mocker):
            # GIVEN a repository and a collection name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            # AND the db.find_one method raises an exception
            given_error = Exception("Database error")
            # Mock the database to raise an exception
            mocker.patch.object(repository._collection, 'find_one', side_effect=given_error)

            # WHEN getting a state
            with pytest.raises(Exception):
                await repository.get_by_session_id(1)

        @pytest.mark.asyncio
        async def test_get_by_session_id_backward_compatibility_old_format(self, in_memory_skills_ranking_state_db):
            # GIVEN a repository and a collection name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            # AND a state in the database with old enum format (GROUP_1 instead of the full value)
            collection = repository._collection

            # Insert document with old format
            old_format_doc = {
                "session_id": 1,
                "experiment_group": "GROUP_1",  # Old format
                "phase": [
                    {
                        "name": "INITIAL",
                        "time": convert_python_datetime_to_mongo_datetime(get_now())
                    }
                ],
                "score": {
                    "calculated_at": convert_python_datetime_to_mongo_datetime(get_now()),
                    "jobs_matching_rank": 0.0,
                    "comparison_rank": 0.0,
                    "comparison_label": "LOWEST"
                },
                "started_at": convert_python_datetime_to_mongo_datetime(get_now())
            }
            await collection.insert_one(old_format_doc)

            # WHEN getting the state
            state = await repository.get_by_session_id(1)

            # THEN the state is returned and converted to new format
            assert state is not None
            assert state.session_id == 1
            assert state.experiment_group == SkillRankingExperimentGroup.GROUP_1
            assert state.experiment_group.name == "GROUP_1"

    class TestCreate:
        """
        Tests for the create method of SkillsRankingRepository.
        """

        @pytest.mark.asyncio
        async def test_create_success(self, in_memory_skills_ranking_state_db, mocker):
            # GIVEN a repository and a collection_name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            # AND a state to create
            given_state = get_skills_ranking_state()

            # AND date

            # WHEN creating the state
            await repository.create(given_state)

            # THEN the state is created in the database
            collection = repository._collection
            assert await collection.count_documents({}) == 1

            # AND the state data matches what we expect
            actual_stored_state = await collection.find_one({})
            _assert_skills_ranking_state_fields_match(given_state, actual_stored_state)

        @pytest.mark.asyncio
        async def test_create_db_error(self, in_memory_skills_ranking_state_db, mocker):
            # GIVEN a repository and a collection_name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            # AND the db.insert_one method raises an exception
            given_error = Exception("Database error")
            # Mock the database to raise an exception
            mocker.patch.object(repository._collection, 'insert_one', side_effect=given_error)

            # WHEN creating a state
            with pytest.raises(Exception):
                await repository.create(get_skills_ranking_state())

    class TestUpdate:
        @pytest.mark.asyncio
        @pytest.mark.parametrize(
            "given_updates",
            [
                {"phase": "BRIEFING"},
                {"cancelled_after": "1000.0ms"},
                {"perceived_rank_percentile": 50.0},
                {"retyped_rank_percentile": 75.0},
                {"completed_at": fixed_time},
                {
                    "phase": "COMPLETED",
                    "cancelled_after": "1000.0ms",
                    "perceived_rank_percentile": 50.0,
                    "retyped_rank_percentile": 75.0,
                    "completed_at": fixed_time
                }
            ],
            ids=[
                "update_phase",
                "update_cancelled_after",
                "update_perceived_rank",
                "update_retyped_rank",
                "update_completed_at",
                "update_all_fields"
            ]
        )
        async def test_update_success(self, in_memory_skills_ranking_state_db, mocker, given_updates: dict):
            # GIVEN a repository and a collection_name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
            mocker.patch('common_libs.time_utilities._time_utils.datetime',
                         new=mocker.Mock(now=lambda tz=None: fixed_time))

            # AND an existing state
            given_state = get_skills_ranking_state()
            await repository.create(given_state)

            # AND new values to update with
            # WHEN updating the state with the given updates
            update_request = UpdateSkillsRankingRequest(**given_updates)
            await repository.update(
                session_id=given_state.session_id,
                update_request=update_request
            )

            # THEN the state is updated in the database
            collection = repository._collection
            assert await collection.count_documents({}) == 1

            # AND the state data matches what we expect
            actual_stored_state = await collection.find_one({})
            expected_state = given_state

            # Handle phase updates specially since it's a list
            if "phase" in given_updates:
                expected_state = expected_state.model_copy()
                expected_state.phase.append(SkillsRankingPhase(
                    name=given_updates["phase"],
                    time=get_now()
                ))
            else:
                expected_state = expected_state.model_copy(update=given_updates)

            # For the all_fields test, we need to handle both phase and other fields
            if "phase" in given_updates and len(given_updates) > 1:
                other_updates = {k: v for k, v in given_updates.items() if k != "phase"}
                expected_state = expected_state.model_copy(update=other_updates)

            _assert_skills_ranking_state_fields_match(expected_state, actual_stored_state)

        @pytest.mark.asyncio
        async def test_update_not_found(self, in_memory_skills_ranking_state_db):
            # GIVEN a repository and a collection_name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            # AND no existing state
            # WHEN updating a non-existent state
            update_request = UpdateSkillsRankingRequest(phase="BRIEFING")
            result = await repository.update(
                session_id=1,
                update_request=update_request
            )

            # THEN the result is None
            assert result is None

        @pytest.mark.asyncio
        async def test_update_db_error(self, in_memory_skills_ranking_state_db, mocker):
            # GIVEN a repository and a collection_name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            # AND an existing state
            given_state = get_skills_ranking_state()
            await repository.create(given_state)

            # AND the db.find_one_and_update method raises an exception
            given_error = Exception("Database error")
            # Mock the database to raise an exception
            mocker.patch.object(repository._collection, 'find_one_and_update', side_effect=given_error)

            # WHEN updating the state
            update_request = UpdateSkillsRankingRequest(phase="BRIEFING")
            with pytest.raises(Exception):
                await repository.update(
                    session_id=given_state.session_id,
                    update_request=update_request
                )

        @pytest.mark.asyncio
        async def test_update_experiment_group_field(self, in_memory_skills_ranking_state_db):
            # GIVEN a repository and a collection_name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            # AND an existing state with GROUP_1
            given_state = get_skills_ranking_state(experiment_group=SkillRankingExperimentGroup.GROUP_1)
            await repository.create(given_state)

            # WHEN updating the experiment group to GROUP_2
            update_request = UpdateSkillsRankingRequest(experiment_group=SkillRankingExperimentGroup.GROUP_2)
            updated_state = await repository.update(
                session_id=given_state.session_id,
                update_request=update_request
            )

            # THEN the state is returned with the updated experiment group
            assert updated_state is not None
            assert updated_state.experiment_group == SkillRankingExperimentGroup.GROUP_2

            # AND the state is updated in the database
            collection = repository._collection
            actual_stored_state = await collection.find_one({})
            assert actual_stored_state["experiment_group"] == "GROUP_2"

        @pytest.mark.asyncio
        async def test_update_phase_and_experiment_group_together(self, in_memory_skills_ranking_state_db):
            # GIVEN a repository and a collection_name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            # AND an existing state with GROUP_1
            given_state = get_skills_ranking_state(experiment_group=SkillRankingExperimentGroup.GROUP_1)
            await repository.create(given_state)

            # WHEN updating both phase and experiment group
            update_request = UpdateSkillsRankingRequest(
                phase="MARKET_DISCLOSURE",
                experiment_group=SkillRankingExperimentGroup.GROUP_3
            )
            updated_state = await repository.update(
                session_id=given_state.session_id,
                update_request=update_request
            )

            # THEN the state is returned with both updates
            assert updated_state is not None
            assert updated_state.experiment_group == SkillRankingExperimentGroup.GROUP_3
            assert updated_state.phase[-1].name == "MARKET_DISCLOSURE"

            # AND the state is updated in the database
            collection = repository._collection
            actual_stored_state = await collection.find_one({})
            assert actual_stored_state["experiment_group"] == "GROUP_3"
            assert len(actual_stored_state["phase"]) == 2  # Original + new phase
            assert actual_stored_state["phase"][-1]["name"] == "MARKET_DISCLOSURE"
