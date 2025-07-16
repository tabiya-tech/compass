import pytest
from unittest.mock import AsyncMock

from app.agent.experience.experience_entity import ExploredExperienceEntity
from app.conversations.experience.service import ExperienceService, ExperienceNotFoundError
from app.conversations.experience.types import UpdateExperienceRequest, SkillUpdate, TimelineUpdate
from app.agent.experience import ExperienceEntity, WorkType, Timeline
from app.agent.explore_experiences_agent_director import DiveInPhase, ExperienceState, ExploreExperiencesAgentDirectorState
from app.countries import Country
from app.metrics.application_state_metrics_recorder.recorder import IApplicationStateMetricsRecorder
from app.application_state import ApplicationState
from app.vector_search.esco_entities import SkillEntity
from common_libs.test_utilities import get_random_user_id, get_random_session_id, get_random_printable_string


@pytest.fixture
def mock_metrics_recorder():
    class MockedRecorder(IApplicationStateMetricsRecorder):
        async def get_state(self, session_id: int):
            raise NotImplementedError()

        async def save_state(self, state: ApplicationState, user_id: str):
            raise NotImplementedError()

        async def delete_state(self, session_id: int):
            raise NotImplementedError()

    return MockedRecorder()


def _make_skill_entity(uuid: str, label: str) -> SkillEntity:
    return SkillEntity(
        id=uuid,
        modelId="model",
        UUID=uuid,
        preferredLabel=label,
        altLabels=[label + "_alt"],
        description="desc",
        score=1.0,
        skillType="skill/competence"
    )


def _make_experience_entity(uuid: str, title: str, skills=None) -> ExperienceEntity:
    return ExperienceEntity(
        uuid=uuid,
        experience_title=title,
        company="fooCorp",
        location="fooVille",
        timeline=Timeline(start="2020", end="2021"),
        work_type=WorkType.SELF_EMPLOYMENT,
        esco_occupations=[],
        questions_and_answers=[],
        summary="fooSummary",
        top_skills=skills or []
    )


def _make_state_with_experience(session_id: int, exp_uuid: str, exp_title: str, skills=None, dive_in_phase=DiveInPhase.PROCESSED):
    exp_entity = _make_experience_entity(exp_uuid, exp_title, skills)
    exp_state = ExperienceState(dive_in_phase=dive_in_phase, experience=exp_entity)
    director_state = ExploreExperiencesAgentDirectorState(
        session_id=session_id,
        experiences_state={exp_uuid: exp_state},
        explored_experiences=[ExploredExperienceEntity.from_experience_entity(exp_entity)],
        current_experience_uuid=None,
        country_of_user=Country.UNSPECIFIED,
    )
    app_state = ApplicationState.new_state(session_id)
    app_state.explore_experiences_director_state = director_state
    return app_state


class TestGetExperiencesBySessionId:
    @pytest.mark.asyncio
    async def test_success(self, mock_metrics_recorder):
        # GIVEN a user and session with an experience
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        skill = _make_skill_entity("skill1", "Skill One")
        app_state = _make_state_with_experience(session_id, exp_uuid, "Test Experience", [skill])
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN get_experiences_by_session_id is called
        result = await service.get_experiences_by_session_id(session_id)

        # THEN it returns the expected experience
        assert len(result) == 1
        exp, dive_in_phase = result[0]
        assert exp.uuid == exp_uuid
        assert exp.experience_title == "Test Experience"
        assert exp.top_skills[0].UUID == "skill1"

        assert dive_in_phase == DiveInPhase.PROCESSED

    @pytest.mark.asyncio
    async def test_empty(self, mock_metrics_recorder):
        # GIVEN a user and session with no experiences
        session_id = get_random_session_id()
        director_state = ExploreExperiencesAgentDirectorState(
            session_id=session_id,
            experiences_state={},
            explored_experiences=[],
            current_experience_uuid=None
        )
        app_state = ApplicationState.new_state(session_id)
        app_state.explore_experiences_director_state = director_state
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN get_experiences_by_session_id is called
        result = await service.get_experiences_by_session_id(session_id)

        # THEN it returns an empty list
        assert result == []

    @pytest.mark.asyncio
    async def test_recorder_throws_error(self, mock_metrics_recorder):
        # GIVEN the metrics recorder will throw an error
        session_id = get_random_session_id()
        given_error = Exception("Something went wrong")
        mock_metrics_recorder.get_state = AsyncMock(side_effect=given_error)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN get_experiences_by_session_id is called
        # THEN the error is propagated
        with pytest.raises(Exception) as error_info:
            await service.get_experiences_by_session_id(session_id)
        assert error_info.value == given_error


class TestUpdateExperience:
    @pytest.mark.asyncio
    async def test_success(self, mock_metrics_recorder):
        # GIVEN a user and session with an experience
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        skill = _make_skill_entity("skill1", "Skill One")
        app_state = _make_state_with_experience(session_id, exp_uuid, "Test Experience", [skill])
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        mock_metrics_recorder.save_state = AsyncMock()
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)
        update_payload = UpdateExperienceRequest(experience_title="Updated Title")

        # WHEN update_experience is called
        exp, dive_in_phase = await service.update_experience(user_id, session_id, exp_uuid, update_payload)

        # THEN the experience is updated and returned
        assert exp.uuid == exp_uuid
        assert exp.experience_title == "Updated Title"
        assert  dive_in_phase == DiveInPhase.PROCESSED
        mock_metrics_recorder.save_state.assert_called_once()

    @pytest.mark.parametrize(
        "update_payload, expected_changes",
        [
            pytest.param(
                UpdateExperienceRequest(experience_title="New Title"),
                {"experience_title": "New Title"},
                id="title_only"
            ),
            pytest.param(
                UpdateExperienceRequest(timeline=TimelineUpdate(start="2022", end="2023")),
                {"timeline": Timeline(start="2022", end="2023")},
                id="timeline_only"
            ),
            pytest.param(
                UpdateExperienceRequest(company="New Co", location="New Loc"),
                {"company": "New Co", "location": "New Loc"},
                id="company_and_location"
            ),
            pytest.param(
                UpdateExperienceRequest(work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name, summary="New Sum"),
                {"work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, "summary": "New Sum"},
                id="work_type_and_summary"
            ),
            pytest.param(
                UpdateExperienceRequest(top_skills=[SkillUpdate(UUID="skill2", preferredLabel="Skill Two New Label", deleted=False)]),
                {"top_skills": [{"UUID": "skill2", "preferredLabel": "Skill Two New Label", "deleted": False}]},
                id="top_skills_update"
            ),
            pytest.param(
                UpdateExperienceRequest(top_skills=[]),
                {"top_skills": []},
                id="top_skills_remove_all"
            ),
            pytest.param(
                UpdateExperienceRequest(top_skills=None),
                {"top_skills": []},
                id="top_skills_set_to_none"
            ),
        ]
    )
    @pytest.mark.asyncio
    async def test_update_fields_success_parameterized(self, mock_metrics_recorder, update_payload, expected_changes):
        # GIVEN a user and session with an experience
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = "exp_to_update"

        # AND some skills available in the experience
        skill1 = _make_skill_entity("skill1", "Skill One")
        skill2 = _make_skill_entity("skill2", "Skill Two")
        # AND another skill in another experience
        skill3 = _make_skill_entity("skill3", "Skill Three")

        # AND an initial experience state
        initial_experience = _make_experience_entity(exp_uuid, "Unedited Title", skills=[skill1, skill2])
        exp_state = ExperienceState(dive_in_phase=DiveInPhase.PROCESSED, experience=initial_experience)

        # AND another unrelated experience
        other_experience = _make_experience_entity("other_exp", "Other Exp", skills=[skill3])
        other_exp_state = ExperienceState(dive_in_phase=DiveInPhase.PROCESSED, experience=other_experience)

        director_state = ExploreExperiencesAgentDirectorState(
            session_id=session_id,
            experiences_state={exp_uuid: exp_state, "other_exp": other_exp_state},
            explored_experiences=[ExploredExperienceEntity.from_experience_entity(initial_experience)],  # This is the one we will update
            current_experience_uuid=None,
            country_of_user=Country.UNSPECIFIED
        )
        app_state = ApplicationState.new_state(session_id)
        app_state.explore_experiences_director_state = director_state

        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        mock_metrics_recorder.save_state = AsyncMock()
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN update_experience is called
        exp, dive_in_phase = await service.update_experience(user_id, session_id, exp_uuid, update_payload)

        # THEN the experience is updated and saved
        mock_metrics_recorder.save_state.assert_called_once()

        # AND the updated fields are correct
        for field, expected in expected_changes.items():
            actual = getattr(exp, field)
            if field == 'top_skills':
                actual_simple = [{'UUID': s.UUID, 'preferredLabel': s.preferredLabel, 'deleted': s.deleted} for s in actual]
                assert actual_simple == expected
            else:
                assert actual == expected

        # AND some non-updated fields are unchanged
        if 'experience_title' not in expected_changes:
            assert exp.experience_title == initial_experience.experience_title
        if 'company' not in expected_changes:
            assert exp.company == initial_experience.company
        if 'top_skills' not in expected_changes:
            unedited_skills = [{'UUID': s.UUID, 'preferredLabel': s.preferredLabel} for s in initial_experience.top_skills]
            result_skills = [{'UUID': s.UUID, 'preferredLabel': s.preferredLabel} for s in exp.top_skills]
            assert result_skills == unedited_skills

        # AND the dive_in_phase is still PROCESSED
        assert dive_in_phase == DiveInPhase.PROCESSED

    @pytest.mark.asyncio
    async def test_not_found(self, mock_metrics_recorder):
        # GIVEN a user and session with NO matching experience
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        app_state = _make_state_with_experience(session_id, "other_uuid", "Other Experience")
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)
        update_payload = UpdateExperienceRequest(experience_title="Updated Title")

        # WHEN update_experience is called with a non-existent uuid
        # THEN it raises ExperienceNotFoundError
        with pytest.raises(ExperienceNotFoundError):
            await service.update_experience(user_id, session_id, exp_uuid, update_payload)

    @pytest.mark.asyncio
    async def test_recorder_get_state_throws_error(self, mock_metrics_recorder):
        # GIVEN the metrics recorder will throw an error on get_state
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        given_error = Exception("Something went wrong")
        mock_metrics_recorder.get_state = AsyncMock(side_effect=given_error)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)
        update_payload = UpdateExperienceRequest(experience_title="Updated Title")

        # WHEN update_experience is called
        # THEN the error is propagated
        with pytest.raises(Exception) as error_info:
            await service.update_experience(user_id, session_id, exp_uuid, update_payload)
        assert error_info.value == given_error

    @pytest.mark.asyncio
    async def test_recorder_save_state_throws_error(self, mock_metrics_recorder):
        # GIVEN the metrics recorder will throw an error on save_state
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        app_state = _make_state_with_experience(session_id, exp_uuid, "Test Experience", [])
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        given_error = Exception("Something went wrong saving")
        mock_metrics_recorder.save_state = AsyncMock(side_effect=given_error)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)
        update_payload = UpdateExperienceRequest(experience_title="Updated Title")

        # WHEN update_experience is called
        # THEN the error is propagated
        with pytest.raises(Exception) as error_info:
            await service.update_experience(user_id, session_id, exp_uuid, update_payload)
        assert error_info.value == given_error


class TestDeleteExperience:
    @pytest.mark.asyncio
    async def test_success(self, mock_metrics_recorder):
        # GIVEN a user and session with an experience
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        app_state = _make_state_with_experience(session_id, exp_uuid, "Test Experience")
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        mock_metrics_recorder.save_state = AsyncMock()
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN delete_experience is called
        await service.delete_experience(user_id, session_id, exp_uuid)

        # THEN the experience is marked as deleted
        for exp in app_state.explore_experiences_director_state.explored_experiences:
            if exp.uuid == exp_uuid:
                assert exp.deleted is True

        # AND the experience uuid should be still in the experience_state for future restore.
        assert exp_uuid in app_state.explore_experiences_director_state.experiences_state

        # AND save_state was called to persist changes
        mock_metrics_recorder.save_state.assert_called_once()

    @pytest.mark.asyncio
    async def test_not_found(self, mock_metrics_recorder):
        # GIVEN a user and session with NO matching experience
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        app_state = _make_state_with_experience(session_id, "other_uuid", "Other Experience")
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN delete_experience is called with a non-existent uuid
        # THEN it raises ExperienceNotFoundError
        with pytest.raises(ExperienceNotFoundError):
            await service.delete_experience(user_id, session_id, exp_uuid)

    @pytest.mark.asyncio
    async def test_recorder_get_state_throws_error(self, mock_metrics_recorder):
        # GIVEN the metrics recorder will throw an error on get_state
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        given_error = Exception("Something went wrong")
        mock_metrics_recorder.get_state = AsyncMock(side_effect=given_error)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN delete_experience is called
        # THEN the error is propagated
        with pytest.raises(Exception) as error_info:
            await service.delete_experience(user_id, session_id, exp_uuid)
        assert error_info.value == given_error


class TestGetUneditedExperienceByUuid:
    @pytest.mark.asyncio
    async def test_success(self, mock_metrics_recorder):
        # GIVEN a user and session with an experience
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        skill = _make_skill_entity("skill1", "Skill One")
        app_state = _make_state_with_experience(session_id, exp_uuid, "Test Experience", [skill])
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN get_unedited_experience_by_uuid is called
        exp, dive_in_phase = await service.get_unedited_experience_by_uuid(session_id, exp_uuid)

        # THEN it returns the expected experience
        assert exp.uuid == exp_uuid
        assert exp.experience_title == "Test Experience"
        assert exp.top_skills[0].UUID == "skill1"
        assert dive_in_phase == DiveInPhase.PROCESSED

    @pytest.mark.asyncio
    async def test_not_found(self, mock_metrics_recorder):
        # GIVEN a user and session with NO matching experience
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        app_state = _make_state_with_experience(session_id, "other_uuid", "Other Experience")
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN get_unedited_experience_by_uuid is called with a non-existent uuid
        # THEN it raises ExperienceNotFoundError
        with pytest.raises(ExperienceNotFoundError):
            await service.get_unedited_experience_by_uuid(session_id, exp_uuid)

    @pytest.mark.asyncio
    async def test_recorder_get_state_throws_error(self, mock_metrics_recorder):
        # GIVEN the metrics recorder will throw an error on get_state
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        given_error = Exception("Something went wrong")
        mock_metrics_recorder.get_state = AsyncMock(side_effect=given_error)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN get_unedited_experience_by_uuid is called
        # THEN the error is propagated
        with pytest.raises(Exception) as error_info:
            await service.get_unedited_experience_by_uuid(session_id, exp_uuid)
        assert error_info.value == given_error


class TestGetAllUneditedExperiences:
    @pytest.mark.asyncio
    async def test_get_unedited_experiences(self, mock_metrics_recorder):
        # GIVEN a user and session with multiple experiences
        session_id = get_random_session_id()
        exp_uuid1 = get_random_printable_string(8)
        exp_uuid2 = get_random_printable_string(8)
        skill1 = _make_skill_entity("skill1", "Skill One")
        skill2 = _make_skill_entity("skill2", "Skill Two")
        app_state = ApplicationState.new_state(session_id)
        app_state.explore_experiences_director_state = ExploreExperiencesAgentDirectorState(
            session_id=session_id,
            experiences_state={
                exp_uuid1: ExperienceState(dive_in_phase=DiveInPhase.PROCESSED, experience=_make_experience_entity(exp_uuid1, "Experience One", [skill1])),
                exp_uuid2: ExperienceState(dive_in_phase=DiveInPhase.PROCESSED, experience=_make_experience_entity(exp_uuid2, "Experience Two", [skill2])),
            },
            explored_experiences=[
                ExploredExperienceEntity.from_experience_entity(_make_experience_entity(exp_uuid1, "Experience One", [skill1])),
                ExploredExperienceEntity.from_experience_entity(_make_experience_entity(exp_uuid2, "Experience Two", [skill2]))
            ],
            current_experience_uuid=None,
            country_of_user=Country.UNSPECIFIED
        )
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN get_unedited_experiences is called
        result = await service.get_unedited_experiences(session_id)

        # THEN it returns all experiences
        assert len(result) == 2
        assert result[0][0].uuid == exp_uuid1
        assert result[0][0].experience_title == "Experience One"
        assert result[0][0].top_skills[0].UUID == "skill1"
        assert result[0][1] == DiveInPhase.PROCESSED
        assert result[1][0].uuid == exp_uuid2
        assert result[1][0].experience_title == "Experience Two"
        assert result[1][0].top_skills[0].UUID == "skill2"
        assert result[1][1] == DiveInPhase.PROCESSED

    @pytest.mark.asyncio
    async def test_get_unedited_experiences_empty(self, mock_metrics_recorder):
        # GIVEN a user and session with no experiences
        session_id = get_random_session_id()
        app_state = ApplicationState.new_state(session_id)
        app_state.explore_experiences_director_state = ExploreExperiencesAgentDirectorState(
            session_id=session_id,
            experiences_state={},
            explored_experiences=[],
            current_experience_uuid=None,
            country_of_user=Country.UNSPECIFIED
        )
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN get_unedited_experiences is called
        result = await service.get_unedited_experiences(session_id)

        # THEN it returns an empty list
        assert result == []

    @pytest.mark.asyncio
    async def test_get_unedited_experiences_recorder_throws_error(self, mock_metrics_recorder):
        # GIVEN the metrics recorder will throw an error
        session_id = get_random_session_id()
        given_error = Exception("Something went wrong")
        mock_metrics_recorder.get_state = AsyncMock(side_effect=given_error)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN get_unedited_experiences is called
        # THEN the error is propagated
        with pytest.raises(Exception) as error_info:
            await service.get_unedited_experiences(session_id)
        assert error_info.value == given_error


class TestRestoreDeletedExperience:
    @pytest.mark.asyncio
    async def test_restore_deleted_experience(self, mock_metrics_recorder):
        # GIVEN a user and session with an experience that was deleted
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        app_state = _make_state_with_experience(session_id, exp_uuid, "Test Experience")
        # Mark the experience as deleted
        for exp in app_state.explore_experiences_director_state.explored_experiences:
            if exp.uuid == exp_uuid:
                exp.deleted = True
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        mock_metrics_recorder.save_state = AsyncMock()
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN restore_deleted_experience is called
        result_exp, result_phase = await service.restore_deleted_experience(user_id, session_id, exp_uuid)

        # THEN the experience is marked as not deleted
        assert not result_exp.deleted

        # AND save_state was called to persist changes
        mock_metrics_recorder.save_state.assert_called_once()

        # AND the correct experience and phase are returned
        assert result_exp.uuid == exp_uuid
        assert result_phase == DiveInPhase.PROCESSED

    @pytest.mark.asyncio
    async def test_restore_not_deleted_experience(self, mock_metrics_recorder):
        # GIVEN a user and session with an experience that was not deleted
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        app_state = _make_state_with_experience(session_id, exp_uuid, "Test Experience") # app state will have the experience in explored experiences
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        mock_metrics_recorder.save_state = AsyncMock()
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN restore_deleted_experience is called
        # THEN it raises ExperienceNotFoundError
        with pytest.raises(ExperienceNotFoundError):
            await service.restore_deleted_experience(user_id, session_id, exp_uuid)

        # AND save_state was not called
        mock_metrics_recorder.save_state.assert_not_called()

    @pytest.mark.asyncio
    async def test_restore_not_found(self, mock_metrics_recorder):
        # GIVEN a user and session with NO matching experience in deleted state
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        app_state = _make_state_with_experience(session_id, "other_uuid", "Other Experience")
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        mock_metrics_recorder.save_state = AsyncMock()
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN restore_deleted_experience is called with a non-existent uuid
        # THEN it raises ExperienceNotFoundError
        with pytest.raises(ExperienceNotFoundError):
            await service.restore_deleted_experience(user_id, session_id, exp_uuid)

        # AND save_state was not called
        mock_metrics_recorder.save_state.assert_not_called()

    @pytest.mark.asyncio
    async def test_recorder_get_state_throws_error(self, mock_metrics_recorder):
        # GIVEN the metrics recorder will throw an error on get_state
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        given_error = Exception("Something went wrong")
        mock_metrics_recorder.get_state = AsyncMock(side_effect=given_error)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)
        # WHEN restore_deleted_experience is called
        # THEN the error is propagated
        with pytest.raises(Exception) as error_info:
            await service.restore_deleted_experience(user_id, session_id, exp_uuid)
        assert error_info.value == given_error

    @pytest.mark.asyncio
    async def test_recorder_save_state_throws_error(self, mock_metrics_recorder):
        # GIVEN a user and session with an experience that was not deleted
        user_id = get_random_user_id()
        session_id = get_random_session_id()
        exp_uuid = get_random_printable_string(8)
        app_state = _make_state_with_experience(session_id, exp_uuid, "Test Experience")
        app_state.explore_experiences_director_state.explored_experiences = []  # Simulate deleted experience
        mock_metrics_recorder.get_state = AsyncMock(return_value=app_state)
        mock_metrics_recorder.save_state = AsyncMock()

        # AND save state will throw an error
        given_error = Exception("Something went wrong saving")
        mock_metrics_recorder.save_state = AsyncMock(side_effect=given_error)
        service = ExperienceService(application_state_metrics_recorder=mock_metrics_recorder)

        # WHEN restore_deleted_experience is called
        # THEN the error is propagated
        with pytest.raises(Exception) as error_info:
            await service.restore_deleted_experience(user_id, session_id, exp_uuid)
        assert error_info.value == given_error
