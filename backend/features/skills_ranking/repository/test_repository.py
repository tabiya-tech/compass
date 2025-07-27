from typing import Awaitable

import pytest

from app.app_config import ApplicationConfig
from common_libs.time_utilities import get_now, convert_python_datetime_to_mongo_datetime
from features.skills_ranking.repository.repository import SkillsRankingRepository
from features.skills_ranking.service.types import SkillsRankingState, SkillsRankingPhaseName, SkillRankingExperimentGroup, SkillsRankingScore, \
    SkillsRankingPhase


@pytest.fixture(scope="function")
async def get_skills_ranking_repository(in_memory_application_database) -> SkillsRankingRepository:
    application_db = await in_memory_application_database
    return SkillsRankingRepository(db=application_db)


def get_skills_ranking_state(
        session_id: int = 1,
        phase: SkillsRankingPhaseName = "INITIAL",
        experiment_group: SkillRankingExperimentGroup = SkillRankingExperimentGroup.GROUP_1
) -> SkillsRankingState:
    return SkillsRankingState(
        session_id=session_id,
        phase=[SkillsRankingPhase(
            name=phase,
            time=get_now()
        )],
        experiment_group=experiment_group,
        score=SkillsRankingScore(
            calculated_at=get_now(),
            jobs_matching_rank=0.0,
            comparison_rank=0.0,
            comparison_label="LOWEST"
        ),
        started_at=get_now(),
        completed_at=None,
        cancelled_after="Fooms",
        succeeded_after="Fooms",
        puzzles_solved=2 if phase == "PROOF_OF_VALUE" and (experiment_group == SkillRankingExperimentGroup.GROUP_2 or experiment_group == SkillRankingExperimentGroup.GROUP_3) else None,
        correct_rotations=1 if phase == "PROOF_OF_VALUE" and (experiment_group == SkillRankingExperimentGroup.GROUP_2 or experiment_group == SkillRankingExperimentGroup.GROUP_3) else None,
        clicks_count=10 if phase == "PROOF_OF_VALUE" and (experiment_group == SkillRankingExperimentGroup.GROUP_2 or experiment_group == SkillRankingExperimentGroup.GROUP_3) else None,
        perceived_rank_percentile=0.1,
        retyped_rank_percentile=0.9
    )


def _assert_skills_ranking_state_fields_match(given_state: SkillsRankingState, actual_stored_state: dict) -> None:
    # Remove MongoDB _id if present
    actual_stored_state.pop("_id", None)

    for field, value in given_state.model_dump().items():
        if field == "experiment_group":
            # Convert enum to string for comparison
            value = value.name
        elif field == "score":
            # Convert score fields to datetime for comparison
            value["calculated_at"] = convert_python_datetime_to_mongo_datetime(value["calculated_at"])
        elif field == "phase":
            # Convert each phase time to datetime for comparison
            value = [
                {
                    "name": p.name if hasattr(p, 'name') else p["name"],
                    "time": convert_python_datetime_to_mongo_datetime(p.time if hasattr(p, 'time') else p["time"])
                } for p in value
            ]
        elif field == "started_at":
            # Convert datetime from mongodb date to datetime for comparison
            value = convert_python_datetime_to_mongo_datetime(value)
        elif field == "completed_at":
            # Convert datetime from mongodb date to datetime for comparison
            if value is not None:
                value = convert_python_datetime_to_mongo_datetime(value)

        assert actual_stored_state[field] == value


class TestSkillsRankingRepository:
    class TestGetBySessionId:
        """
        Tests for the get_by_session_id method of SkillsRankingRepository.
        """

        @pytest.mark.asyncio
        async def test_get_by_session_id_not_found(
                self,
                get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
                setup_application_config: ApplicationConfig
        ):
            # GIVEN a repository
            repository = await get_skills_ranking_repository

            # WHEN getting a non-existent state
            state = await repository.get_by_session_id(1)

            # THEN the state is None
            assert state is None

        @pytest.mark.asyncio
        async def test_get_by_session_id_found(
                self,
                get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
                setup_application_config: ApplicationConfig
        ):
            # GIVEN a repository
            repository = await get_skills_ranking_repository

            # AND a state in the database
            given_state = get_skills_ranking_state()
            await repository.create(given_state)

            # WHEN getting the state
            state = await repository.get_by_session_id(1)

            # THEN the state is returned
            assert state is not None
            assert state.session_id == given_state.session_id

        @pytest.mark.asyncio
        async def test_get_by_session_id_db_error(
                self,
                get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
                setup_application_config: ApplicationConfig,
                mocker,
        ):
            # GIVEN a repository
            repository = await get_skills_ranking_repository

            # AND the db.find_one method raises an exception]
            given_error = Exception("Database error")
            _find_one_and_update_spy = mocker.spy(repository._collection, 'find_one')
            _find_one_and_update_spy.side_effect = given_error

            # WHEN getting a state
            with pytest.raises(Exception):
                await repository.get_by_session_id(1)

    class TestCreate:
        """
        Tests for the create method of SkillsRankingRepository.
        """

        @pytest.mark.asyncio
        async def test_create_success(
                self,
                get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
                setup_application_config: ApplicationConfig
        ):
            # GIVEN a repository
            repository = await get_skills_ranking_repository

            # AND a state to create
            given_state = get_skills_ranking_state()

            # WHEN creating the state
            await repository.create(given_state)

            # THEN the state is created in the database
            assert await repository._collection.count_documents({}) == 1

            # AND the state data matches what we expect
            actual_stored_state = await repository._collection.find_one({})
            _assert_skills_ranking_state_fields_match(given_state, actual_stored_state)

        @pytest.mark.asyncio
        async def test_create_db_error(
                self,
                get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
                setup_application_config: ApplicationConfig,
                mocker
        ):
            # GIVEN a repository
            repository = await get_skills_ranking_repository

            # AND the db.insert_one method raises an exception
            given_error = Exception("Database error")
            _insert_one_spy = mocker.spy(repository._collection, 'insert_one')
            _insert_one_spy.side_effect = given_error

            # WHEN creating a state
            with pytest.raises(Exception):
                await repository.create(get_skills_ranking_state())

    class TestUpdate:
        @pytest.mark.asyncio
        @pytest.mark.parametrize(
            "given_updates",
            [
                {"phase": SkillsRankingPhase(
                    name="BRIEFING",
                    time=get_now()
                )},
                {"cancelled_after": "1000.0ms"},
                {"perceived_rank_percentile": 50.0},
                {"retyped_rank_percentile": 75.0},
                {"completed_at": get_now()},
                {
                    "phase": SkillsRankingPhase(
                        name="COMPLETED",
                        time=get_now()
                    ),
                    "cancelled_after": "1000.0ms",
                    "perceived_rank_percentile": 50.0,
                    "retyped_rank_percentile": 75.0,
                    "completed_at": get_now()
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
        async def test_update_success(
                self,
                get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
                setup_application_config: ApplicationConfig,
                given_updates: dict
        ):
            # GIVEN a repository
            repository = await get_skills_ranking_repository

            # AND an existing state
            given_state = get_skills_ranking_state()
            await repository.create(given_state)

            # AND new values to update with
            # WHEN updating the state with the given updates
            await repository.update(
                session_id=given_state.session_id,
                **given_updates
            )

            # THEN the state is updated in the database
            assert await repository._collection.count_documents({}) == 1

            # AND the state data matches what we expect
            actual_stored_state = await repository._collection.find_one({})
            expected_state = given_state
            
            # Handle phase updates specially since it's a list
            if "phase" in given_updates:
                expected_state = expected_state.model_copy()
                expected_state.phase.append(given_updates["phase"])
            else:
                expected_state = expected_state.model_copy(update=given_updates)
                
            # For the all_fields test, we need to handle both phase and other fields
            if "phase" in given_updates and len(given_updates) > 1:
                other_updates = {k: v for k, v in given_updates.items() if k != "phase"}
                expected_state = expected_state.model_copy(update=other_updates)
                
            _assert_skills_ranking_state_fields_match(expected_state, actual_stored_state)

        @pytest.mark.asyncio
        async def test_update_not_found(
                self,
                get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
                setup_application_config: ApplicationConfig
        ):
            # GIVEN a repository
            repository = await get_skills_ranking_repository

            # AND no existing state
            # WHEN updating a non-existent state
            result = await repository.update(
                session_id=1,
                phase=SkillsRankingPhase(
                    name="BRIEFING",
                    time=get_now()
                )
            )

            # THEN the result is None
            assert result is None

        @pytest.mark.asyncio
        async def test_update_db_error(
                self,
                get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
                setup_application_config: ApplicationConfig,
                mocker
        ):
            # GIVEN a repository
            repository = await get_skills_ranking_repository

            # AND an existing state
            given_state = get_skills_ranking_state()
            await repository.create(given_state)

            # AND the db.find_one_and_update method raises an exception
            given_error = Exception("Database error")
            _find_one_and_update_spy = mocker.spy(repository._collection, 'find_one_and_update')
            _find_one_and_update_spy.side_effect = given_error

            # WHEN updating the state
            with pytest.raises(Exception):
                await repository.update(
                    session_id=given_state.session_id,
                    phase=SkillsRankingPhase(
                        name="BRIEFING",
                        time=get_now()
                    )
                )
