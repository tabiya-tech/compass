from enum import Enum

import pytest
from datetime import datetime, timezone
import uuid

from app.agent.agent_director.abstract_agent_director import AgentDirectorState, ConversationPhase
from app.agent.experience import ExperienceEntity, WorkType, Timeline
from app.agent.explore_experiences_agent_director import ConversationPhase as CounselingPhase, ExperienceState
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState, DiveInPhase
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_types import (
    ConversationMemoryManagerState, 
    ConversationTurn
)
from app.metrics.application_state_metrics_recorder.types import ApplicationStatesOfInterest
from common_libs.test_utilities import get_random_session_id
from app.agent.experience.experience_entity import SkillEntity


def get_empty_state() -> ApplicationState:
    """Returns a clean application state"""
    return ApplicationState.new_state(session_id=get_random_session_id())


class TestInitialState:
    """Tests for initial state behavior"""
    
    def test_empty_state(self):
        # GIVEN an empty application state
        state = get_empty_state()
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the result should have default values
        assert result.conversation_phase == "NOT_STARTED"
        assert result.counseling_phase == "NOT_STARTED"
        assert result.compass_message_count == 0
        assert result.user_message_count == 0
        assert result.experiences_explored_count == 0


class TestMessageCounting:
    """Tests for message counting logic"""
    
    def test_message_counting_logic(self):
        # GIVEN a state with multiple message types
        state = get_empty_state()
        
        # Regular user message with compass response
        state.conversation_memory_manager_state.all_history.turns.append(
            ConversationTurn(
                index=0,
                input=AgentInput(
                    message="Hello",  # Valid user message
                    is_artificial=False,
                    sent_at=datetime.now(timezone.utc)
                ),
                output=AgentOutput(
                    message_for_user="Hi there",  # Valid compass message
                    finished=True,
                    agent_response_time_in_sec=1.0,
                    llm_stats=[],
                    sent_at=datetime.now(timezone.utc)
                )
            )
        )

        # Empty user message with compass response
        state.conversation_memory_manager_state.all_history.turns.append(
            ConversationTurn(
                index=1,
                input=AgentInput(
                    message="",  # Empty user message
                    is_artificial=False,
                    sent_at=datetime.now(timezone.utc)
                ),
                output=AgentOutput(
                    message_for_user="Welcome!",  # Valid compass message
                    finished=True,
                    agent_response_time_in_sec=1.0,
                    llm_stats=[],
                    sent_at=datetime.now(timezone.utc)
                )
            )
        )

        # Artificial user message with compass response
        state.conversation_memory_manager_state.all_history.turns.append(
            ConversationTurn(
                index=2,
                input=AgentInput(
                    message="Artificial message",  # Artificial message
                    is_artificial=True,
                    sent_at=datetime.now(timezone.utc)
                ),
                output=AgentOutput(
                    message_for_user="Response to artificial",  # Valid compass message
                    finished=True,
                    agent_response_time_in_sec=1.0,
                    llm_stats=[],
                    sent_at=datetime.now(timezone.utc)
                )
            )
        )

        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN only valid messages should be counted
        # - Only 1 valid user message (the "Hello" message)
        # - 3 valid compass messages (one for each turn)
        assert result.user_message_count == 1
        assert result.compass_message_count == 3


class TestConversationPhase:
    """Tests for conversation phase transitions"""
    
    def test_conversation_phase_not_started(self):
        # GIVEN a state in INTRO phase with no messages
        state = get_empty_state()
        state.agent_director_state.current_phase = ConversationPhase.INTRO
        # guard ensure that the messages count is 0
        assert state.conversation_memory_manager_state.all_history.turns == []

        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the conversation phase should be NOT_STARTED
        assert result.conversation_phase == "NOT_STARTED"

    def test_conversation_phase_intro_with_messages(self):
        # GIVEN a state in INTRO phase with messages
        state = get_empty_state()
        state.agent_director_state.current_phase = ConversationPhase.INTRO
        state.conversation_memory_manager_state.all_history.turns.append(
            ConversationTurn(
                index=0,
                input=AgentInput(
                    message="Hello",
                    is_artificial=False,
                    sent_at=datetime.now(timezone.utc)
                ),
                output=AgentOutput(
                    message_for_user="Hi there",
                    finished=True,
                    agent_response_time_in_sec=1.0,
                    llm_stats=[],
                    sent_at=datetime.now(timezone.utc)
                )
            )
        )
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the conversation phase should be INTRO
        assert result.conversation_phase == "INTRO"

    def test_conversation_phase_counseling(self):
        # GIVEN a state in COUNSELING phase
        state = get_empty_state()
        state.agent_director_state.current_phase = ConversationPhase.COUNSELING
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the conversation phase should be COUNSELING
        assert result.conversation_phase == "COUNSELING"

    def test_conversation_phase_checkout(self):
        # GIVEN a state in CHECKOUT phase
        state = get_empty_state()
        state.agent_director_state.current_phase = ConversationPhase.CHECKOUT
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the conversation phase should be CHECKOUT
        assert result.conversation_phase == "CHECKOUT"

    def test_conversation_phase_ended(self):
        # GIVEN a state in ENDED phase
        state = get_empty_state()
        state.agent_director_state.current_phase = ConversationPhase.ENDED
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the conversation phase should be ENDED
        assert result.conversation_phase == "ENDED"

    def test_invalid_conversation_phase_raises_error(self):
        # GIVEN a state with an invalid conversation phase
        # This is a hypothetical case, as the phase should be one of the defined enums
        # but we want to ensure that the code handles this gracefully so we create an enum
        # that is not in the ConversationPhase enum
        class InvalidPhase(str, Enum):
            INVALID_PHASE = "INVALID_PHASE"

        state = get_empty_state()
        state.agent_director_state.current_phase = InvalidPhase.INVALID_PHASE  # type: ignore
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        # THEN a ValueError should be raised
        with pytest.raises(ValueError, match="Unexpected conversation phase: InvalidPhase.INVALID_PHASE"):
            ApplicationStatesOfInterest.from_state(state)


class TestCounselingPhase:
    """Tests for counseling phase transitions"""
    
    def test_counseling_phase_not_started_in_intro(self):
        # GIVEN a state in INTRO phase
        state = get_empty_state()
        state.agent_director_state.current_phase = ConversationPhase.INTRO
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the counseling phase should be NOT_STARTED
        assert result.counseling_phase == "NOT_STARTED"

    def test_counseling_phase_collect_experiences(self):
        # GIVEN a state in COUNSELING phase with COLLECT_EXPERIENCES counseling phase
        state = get_empty_state()
        state.agent_director_state.current_phase = ConversationPhase.COUNSELING
        state.explore_experiences_director_state.conversation_phase = CounselingPhase.COLLECT_EXPERIENCES
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the counseling phase should be COLLECT_EXPERIENCES
        assert result.counseling_phase == "COLLECT_EXPERIENCES"

    def test_counseling_phase_dive_in(self):
        # GIVEN a state in COUNSELING phase with DIVE_IN counseling phase
        state = get_empty_state()
        state.agent_director_state.current_phase = ConversationPhase.COUNSELING
        state.explore_experiences_director_state.conversation_phase = CounselingPhase.DIVE_IN
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the counseling phase should be DIVE_IN
        assert result.counseling_phase == "DIVE_IN"

    def test_counseling_phase_ended(self):
        # GIVEN a state in ENDED phase
        state = get_empty_state()
        state.agent_director_state.current_phase = ConversationPhase.ENDED
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the counseling phase should be ENDED
        assert result.counseling_phase == "ENDED"


class TestExperienceExploration:
    """Tests for experience exploration counting"""
    
    def test_experiences_explored_count_zero(self):
        # GIVEN a state with no experiences
        state = get_empty_state()
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the experiences explored count should be 0
        assert result.experiences_explored_count == 0

    def test_experiences_explored_count_one(self):
        # GIVEN a state with one processed experience
        state = get_empty_state()
        experience = ExperienceEntity(
            uuid=str(uuid.uuid4()),
            experience_title="Test Experience",
        )
        experience_state = ExperienceState(
            dive_in_phase=DiveInPhase.PROCESSED,
            experience=experience
        )
        state.explore_experiences_director_state.experiences_state = {experience.uuid: experience_state}
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the experiences explored count should be 1
        assert result.experiences_explored_count == 1

    def test_experiences_explored_count_with_unprocessed(self):
        # GIVEN a state with one processed experience and one unprocessed experience
        state = get_empty_state()
        
        # Processed experience
        processed_experience = ExperienceEntity(
            uuid=str(uuid.uuid4()),
            experience_title="Processed Experience",
        )
        processed_experience_state = ExperienceState(
            dive_in_phase=DiveInPhase.PROCESSED,
            experience=processed_experience
        )
        
        # Unprocessed experience
        unprocessed_experience = ExperienceEntity(
            uuid=str(uuid.uuid4()),
            experience_title="Unprocessed Experience",
        )
        unprocessed_experience_state = ExperienceState(
            dive_in_phase=DiveInPhase.NOT_STARTED,
            experience=unprocessed_experience
        )
        
        state.explore_experiences_director_state.experiences_state = {
            processed_experience.uuid: processed_experience_state,
            unprocessed_experience.uuid: unprocessed_experience_state
        }
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the experiences explored count should be 1 (only the processed one)
        assert result.experiences_explored_count == 1
        
class TestExperienceDiscovery:
    """Tests for experience discovery counting"""
    
    def test_experiences_discovered_count(self):
        # GIVEN a state in DIVE_IN phase with one discovered experience
        state = get_empty_state()
        
        # Discovered experience
        discovered_experience = ExperienceEntity(
            uuid=str(uuid.uuid4()),
            experience_title="Discovered Experience",
        )
        discovered_experience_state = ExperienceState(
            dive_in_phase=DiveInPhase.NOT_STARTED,
            experience=discovered_experience
        )
        
        state.explore_experiences_director_state.experiences_state = {
            discovered_experience.uuid: discovered_experience_state
        }
        
        # WHEN creating an ApplicationStatesOfInterest from the state
        result = ApplicationStatesOfInterest.from_state(state)
        
        # THEN the experiences discovered count should be 1
        assert result.experiences_discovered_count == 1