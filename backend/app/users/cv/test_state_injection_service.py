import pytest
from unittest.mock import AsyncMock

from app.application_state import ApplicationState
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.explore_experiences_agent_director import ExperienceState, DiveInPhase
from app.agent.experience.experience_entity import ExperienceEntity, ResponsibilitiesData
from app.agent.experience.timeline import Timeline
from app.agent.experience.work_type import WorkType
from app.users.cv.services.state_injection_service import StateInjectionService
from app.users.cv.types import CVStructuredExtraction


def _create_test_collected_data(*, experience_title: str = "Software Engineer",
                                company: str = "Tech Corp",
                                location: str = "San Francisco",
                                start_date: str = "2020-01-01",
                                end_date: str = "2022-12-31",
                                index: int = 0) -> CollectedData:
    """Helper to create test CollectedData"""
    return CollectedData(
        index=index,
        experience_title=experience_title,
        company=company,
        location=location,
        start_date=start_date,
        end_date=end_date,
        paid_work=True,
        work_type="waged-employee"
    )


def _create_test_experience_entity(*, uuid: str = "exp1",
                                   experience_title: str = "Software Engineer",
                                   company: str = "Tech Corp",
                                   location: str = "San Francisco",
                                   start_date: str = "2020-01-01",
                                   end_date: str = "2022-12-31",
                                   responsibilities: list[str] | None = None) -> ExperienceEntity:
    """Helper to create test ExperienceEntity"""
    # Use default responsibilities only if None is explicitly passed (not if empty list)
    default_responsibilities = responsibilities if responsibilities is not None else ["Developed web applications"]
    return ExperienceEntity(
        uuid=uuid,
        experience_title=experience_title,
        company=company,
        location=location,
        timeline=Timeline(start=start_date, end=end_date),
        work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        responsibilities=ResponsibilitiesData(
            responsibilities=default_responsibilities
        )
    )


class TestStateInjectionService:
    """Tests for StateInjectionService"""

    @pytest.mark.asyncio
    async def test_inject_cv_data_populates_collect_explore_and_skills_when_responsibilities_sufficient(self):
        """Test that inject_cv_data properly populates all three agent states when data is complete."""
        # GIVEN a session and user
        given_session_id = 123
        given_user_id = "user123"
        given_application_state = ApplicationState.new_state(session_id=given_session_id)
        
        # AND a mock application state manager with the fresh state
        mock_state_manager = AsyncMock()
        mock_state_manager.get_state = AsyncMock(return_value=given_application_state)
        mock_state_manager.save_state = AsyncMock()
        
        # AND a state injection service
        injection_service = StateInjectionService(application_state_manager=mock_state_manager)
        
        # AND structured extraction data with collected data and experience entities
        given_collected_data = [
            _create_test_collected_data(experience_title="Software Engineer", index=0)
        ]
        
        given_experience_entity = _create_test_experience_entity(
            uuid="exp1",
            experience_title="Software Engineer",
            responsibilities=[
                "Designed scalable web applications",
                "Led code reviews across the team",
                "Optimized deployment pipelines",
            ],
        )
        
        given_structured_extraction = CVStructuredExtraction(
            collected_data=given_collected_data,
            experience_entities=[given_experience_entity],
            extraction_metadata={}
        )
        
        # WHEN injecting CV data
        injection_result = await injection_service.inject_cv_data(
            user_id=given_user_id,
            session_id=given_session_id,
            structured_extraction=given_structured_extraction
        )
        
        # THEN injection should succeed
        assert injection_result is True
        
        # AND state manager should be called correctly
        mock_state_manager.get_state.assert_called_once_with(given_session_id)
        mock_state_manager.save_state.assert_called_once_with(given_application_state)
        
        # AND CollectExperiencesAgent state should have collected data
        assert len(given_application_state.collect_experience_state.collected_data) == 1
        assert given_application_state.collect_experience_state.collected_data[0].experience_title == "Software Engineer"
        assert given_application_state.collect_experience_state.first_time_visit is False
        
        # AND ExploreExperiencesAgent state should have experience entities
        assert len(given_application_state.explore_experiences_director_state.experiences_state) == 1
        assert "exp1" in given_application_state.explore_experiences_director_state.experiences_state
        injected_experience_state = given_application_state.explore_experiences_director_state.experiences_state["exp1"]
        assert injected_experience_state.experience.experience_title == "Software Engineer"
        assert injected_experience_state.experience.uuid == "exp1"
        # State injection service sets NOT_STARTED; agent director will decide flow based on responsibilities
        assert injected_experience_state.dive_in_phase.name == "NOT_STARTED"
        assert injected_experience_state.experience.questions_and_answers
        question, answer = injected_experience_state.experience.questions_and_answers[-1]
        assert "captured from your CV" in question
        assert "• Designed scalable web applications" in answer
        
        # SkillsExplorerAgent treats CV-injected experiences as fresh (agent director will decide flow)
        assert "exp1" not in given_application_state.skills_explorer_agent_state.first_time_for_experience

    @pytest.mark.asyncio
    async def test_inject_cv_data_resets_existing_state_to_not_started(self):
        """Existing experiences are reset to NOT_STARTED so agent director can decide flow based on responsibilities."""

        given_session_id = 321
        given_user_id = "user321"
        given_application_state = ApplicationState.new_state(session_id=given_session_id)

        # Seed an existing experience in EXPLORING_SKILLS phase with no responsibilities
        seeded_experience = _create_test_experience_entity(
            uuid="exp-existing",
            experience_title="Project Manager",
            responsibilities=[]
        )
        given_application_state.explore_experiences_director_state.experiences_state["exp-existing"] = ExperienceState(
            dive_in_phase=DiveInPhase.EXPLORING_SKILLS,
            experience=seeded_experience
        )

        mock_state_manager = AsyncMock()
        mock_state_manager.get_state = AsyncMock(return_value=given_application_state)
        mock_state_manager.save_state = AsyncMock()

        injection_service = StateInjectionService(application_state_manager=mock_state_manager)

        enriched_experience = _create_test_experience_entity(
            uuid="exp-existing",
            experience_title="Project Manager",
            responsibilities=[
                "Coordinated cross-team delivery timelines",
                "Managed sprint planning ceremonies",
                "Tracked project risks and mitigation plans",
            ]
        )

        given_structured_extraction = CVStructuredExtraction(
            collected_data=[_create_test_collected_data(index=0, experience_title="Project Manager")],
            experience_entities=[enriched_experience],
            extraction_metadata={}
        )

        injection_result = await injection_service.inject_cv_data(
            user_id=given_user_id,
            session_id=given_session_id,
            structured_extraction=given_structured_extraction
        )

        assert injection_result is True

        updated_state = given_application_state.explore_experiences_director_state.experiences_state["exp-existing"]
        # State injection service resets to NOT_STARTED; agent director will decide flow
        assert updated_state.dive_in_phase == DiveInPhase.NOT_STARTED
        assert updated_state.experience.responsibilities.responsibilities == [
            "Coordinated cross-team delivery timelines",
            "Managed sprint planning ceremonies",
            "Tracked project risks and mitigation plans",
        ]

        question, answer = updated_state.experience.questions_and_answers[-1]
        assert "captured from your CV" in question
        assert "• Coordinated cross-team delivery timelines" in answer

        # SkillsExplorerAgent treats CV-injected experiences as fresh
        assert "exp-existing" not in given_application_state.skills_explorer_agent_state.first_time_for_experience

    @pytest.mark.asyncio
    async def test_inject_cv_data_leaves_sparse_responsibilities_for_conversation(self):
        """Experiences with few responsibilities should remain in exploratory mode."""

        given_session_id = 789
        given_user_id = "user789"
        given_application_state = ApplicationState.new_state(session_id=given_session_id)

        mock_state_manager = AsyncMock()
        mock_state_manager.get_state = AsyncMock(return_value=given_application_state)
        mock_state_manager.save_state = AsyncMock()

        injection_service = StateInjectionService(application_state_manager=mock_state_manager)

        sparse_experience = _create_test_experience_entity(
            uuid="exp-sparse",
            experience_title="Analyst",
            responsibilities=["Prepared weekly status reports"],
        )

        given_structured_extraction = CVStructuredExtraction(
            collected_data=[_create_test_collected_data(index=0, experience_title="Analyst")],
            experience_entities=[sparse_experience],
            extraction_metadata={}
        )

        injection_result = await injection_service.inject_cv_data(
            user_id=given_user_id,
            session_id=given_session_id,
            structured_extraction=given_structured_extraction
        )

        assert injection_result is True

        experience_state = given_application_state.explore_experiences_director_state.experiences_state["exp-sparse"]
        assert experience_state.dive_in_phase.name == "NOT_STARTED"
        assert experience_state.experience.questions_and_answers
        assert given_application_state.skills_explorer_agent_state.first_time_for_experience.get("exp-sparse") is None
        assert all(
            "Analyst" not in summary
            for summary in given_application_state.skills_explorer_agent_state.experiences_explored
        )

    @pytest.mark.asyncio
    async def test_inject_cv_data_preserves_conversation_when_no_responsibilities(self):
        """Experiences without responsibilities should still go through the normal dive-in flow."""
        given_session_id = 456
        given_user_id = "user456"
        given_application_state = ApplicationState.new_state(session_id=given_session_id)

        mock_state_manager = AsyncMock()
        mock_state_manager.get_state = AsyncMock(return_value=given_application_state)
        mock_state_manager.save_state = AsyncMock()

        injection_service = StateInjectionService(application_state_manager=mock_state_manager)

        experience_without_responsibilities = ExperienceEntity(
            uuid="exp-empty",
            experience_title="Assistant",
            responsibilities=ResponsibilitiesData(responsibilities=[])
        )

        given_structured_extraction = CVStructuredExtraction(
            collected_data=[_create_test_collected_data(index=0, experience_title="Assistant")],
            experience_entities=[experience_without_responsibilities],
            extraction_metadata={}
        )

        injection_result = await injection_service.inject_cv_data(
            user_id=given_user_id,
            session_id=given_session_id,
            structured_extraction=given_structured_extraction
        )

        assert injection_result is True

        injected_state = given_application_state.explore_experiences_director_state.experiences_state["exp-empty"]
        assert injected_state.dive_in_phase.name == "NOT_STARTED"
        assert injected_state.experience.questions_and_answers == []
        assert "exp-empty" not in given_application_state.skills_explorer_agent_state.first_time_for_experience

    @pytest.mark.asyncio
    async def test_inject_cv_data_handles_state_manager_error(self):
        """Test that injection handles errors from state manager gracefully"""
        # GIVEN a session and user
        given_session_id = 999
        given_user_id = "user999"
        
        # AND a state manager that raises an error on get_state
        failing_state_manager = AsyncMock()
        failing_state_manager.get_state = AsyncMock(side_effect=Exception("State fetch failed"))
        
        # AND a state injection service
        injection_service = StateInjectionService(application_state_manager=failing_state_manager)
        
        # AND structured extraction data
        given_structured_extraction = CVStructuredExtraction(
            collected_data=[_create_test_collected_data(index=0, experience_title="Test")],
            experience_entities=[],
            extraction_metadata={}
        )
        
        # WHEN injecting data and state manager fails
        injection_result = await injection_service.inject_cv_data(
            user_id=given_user_id,
            session_id=given_session_id,
            structured_extraction=given_structured_extraction
        )
        
        # THEN injection should return False
        assert injection_result is False
        
        # AND save_state should not be called
        failing_state_manager.save_state.assert_not_called()
