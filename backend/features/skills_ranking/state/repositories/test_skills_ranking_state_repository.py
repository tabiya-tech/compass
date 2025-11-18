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
            assert state.metadata.session_id == given_state.metadata.session_id

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
                {"metadata": {"cancelled_after": "1000.0ms"}},
                {"user_responses": {"perceived_rank_percentile": 50.0}},
                {"user_responses": {"perceived_rank_for_skill_percentile": 75.0}},
                {"completed_at": fixed_time},
                {
                    "phase": "COMPLETED",
                    "metadata": {"cancelled_after": "1000.0ms"},
                    "user_responses": {
                    "perceived_rank_percentile": 50.0,
                        "perceived_rank_for_skill_percentile": 75.0,
                        "application_willingness": {"value": 4, "label": "Likely"}
                    },
                    "completed_at": fixed_time
                }
            ],
            ids=[
                "update_phase",
                "update_cancelled_after",
                "update_perceived_rank",
                "update_perceived_rank_for_skill",
                "update_completed_at",
                "update_all_fields"
            ]
        )
        async def test_update_success(self, in_memory_skills_ranking_state_db, mocker, given_updates: dict):
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            fixed_time = datetime(2025, 3, 4, 6, 45, 0, tzinfo=timezone.utc)
            mocker.patch('common_libs.time_utilities._time_utils.datetime',
                         new=mocker.Mock(now=lambda tz=None: fixed_time))

            given_state = get_skills_ranking_state()
            await repository.create(given_state)

            update_request = UpdateSkillsRankingRequest(**given_updates)
            await repository.update(
                session_id=given_state.metadata.session_id,
                update_request=update_request
            )

            collection = repository._collection
            assert await collection.count_documents({}) == 1

            actual_stored_state = await collection.find_one({})
            expected_state = given_state.model_copy(deep=True)

            if "phase" in given_updates:
                expected_state.phase.append(SkillsRankingPhase(
                    name=given_updates["phase"],
                    time=get_now()
                ))

            if "metadata" in given_updates:
                for key, value in given_updates["metadata"].items():
                    setattr(expected_state.metadata, key, value)

            if "user_responses" in given_updates:
                for key, value in given_updates["user_responses"].items():
                    if key == "application_willingness" and isinstance(value, dict):
                        from features.skills_ranking.state.services.type import ApplicationWillingness
                        value = ApplicationWillingness(**value)
                    setattr(expected_state.user_responses, key, value)

            if "completed_at" in given_updates:
                expected_state.metadata.completed_at = given_updates["completed_at"]

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
                    session_id=given_state.metadata.session_id,
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

            update_request = UpdateSkillsRankingRequest(metadata={"experiment_group": SkillRankingExperimentGroup.GROUP_2})
            updated_state = await repository.update(
                session_id=given_state.metadata.session_id,
                update_request=update_request
            )

            assert updated_state is not None
            assert updated_state.metadata.experiment_group == SkillRankingExperimentGroup.GROUP_2

            # AND the state is updated in the database
            collection = repository._collection
            actual_stored_state = await collection.find_one({})
            assert actual_stored_state["metadata"]["experiment_group"] == "GROUP_2"

        @pytest.mark.asyncio
        async def test_update_phase_and_experiment_group_together(self, in_memory_skills_ranking_state_db):
            # GIVEN a repository and a collection_name
            given_collection_name = "skills_ranking_state"
            repository = SkillsRankingStateRepository(in_memory_skills_ranking_state_db, given_collection_name)

            # AND an existing state with GROUP_1
            given_state = get_skills_ranking_state(experiment_group=SkillRankingExperimentGroup.GROUP_1)
            await repository.create(given_state)

            update_request = UpdateSkillsRankingRequest(
                phase="DISCLOSURE",
                metadata={"experiment_group": SkillRankingExperimentGroup.GROUP_3}
            )
            updated_state = await repository.update(
                session_id=given_state.metadata.session_id,
                update_request=update_request
            )

            assert updated_state is not None
            assert updated_state.metadata.experiment_group == SkillRankingExperimentGroup.GROUP_3
            assert updated_state.phase[-1].name == "DISCLOSURE"

            # AND the state is updated in the database
            collection = repository._collection
            actual_stored_state = await collection.find_one({})
            assert actual_stored_state["metadata"]["experiment_group"] == "GROUP_3"
            assert len(actual_stored_state["phase"]) == 2
            assert actual_stored_state["phase"][-1]["name"] == "DISCLOSURE"
